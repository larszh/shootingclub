import "server-only";
import { db } from "@/lib/db";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/auth";
import { appUrl } from "@/lib/mail";
import { INVITE_DAYS, mailInvitation, mailSetPassword } from "@/lib/mail/platform-mails";
import { isTenantRole } from "@/lib/permissions";
import { todayZurich } from "@/lib/time";

/**
 * Einladungen in einen Verein und «Passwort festlegen» für importierte Mitglieder.
 * Der Klartext-Token steht nur im Link; in der DB liegt der SHA-256-Hash.
 */

const DAY = 86_400_000;

export type CreateInvitationInput = {
  tenantId: string;
  email: string;
  name?: string | null;
  role?: string;
  invitedById: string;
  /** Standard true: Einladungsmail in die Warteschlange legen. */
  sendMail?: boolean;
};

/**
 * Legt eine Einladung an (offene Einladungen an dieselbe Adresse im selben Verein werden ersetzt)
 * und verschickt optional die Mail. Rückgabe: id und Link zum Annehmen.
 */
export async function createInvitation(i: CreateInvitationInput): Promise<{ id: string; url: string }> {
  const email = i.email.trim().toLowerCase().slice(0, 191);
  if (!email.includes("@")) throw new Error("Ungültige E-Mail");
  const role = i.role && isTenantRole(i.role) ? i.role : "MEMBER";
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * DAY);

  const inv = await db.$transaction(async (tx) => {
    await tx.invitation.deleteMany({ where: { tenantId: i.tenantId, email, acceptedAt: null } });
    return tx.invitation.create({
      data: { tenantId: i.tenantId, email, name: i.name?.trim().slice(0, 191) || null, role, tokenHash: hashOpaqueToken(token), invitedById: i.invitedById, expiresAt },
      select: { id: true },
    });
  });

  if (i.sendMail !== false) {
    const inviter = await db.user.findUnique({ where: { id: i.invitedById }, select: { name: true } });
    await mailInvitation({ tenantId: i.tenantId, email, name: i.name, role, inviterName: inviter?.name ?? null, token, days: INVITE_DAYS });
  }
  return { id: inv.id, url: appUrl(`/invite/${token}`) };
}

export type InvitationView = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantCity: string | null;
  tenantLogoPath: string | null;
  tenantUpdatedAt: Date;
  email: string;
  name: string | null;
  role: string;
  state: "open" | "expired" | "accepted";
};

/** Einladung zu einem Token (oder null). */
export async function findInvitation(token: string): Promise<InvitationView | null> {
  if (!token || token.length > 100) return null;
  const inv = await db.invitation.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
    include: { tenant: { select: { name: true, city: true, logoPath: true, updatedAt: true, deletedAt: true } } },
  });
  if (!inv || inv.tenant.deletedAt) return null;
  return {
    id: inv.id,
    tenantId: inv.tenantId,
    tenantName: inv.tenant.name,
    tenantCity: inv.tenant.city,
    tenantLogoPath: inv.tenant.logoPath,
    tenantUpdatedAt: inv.tenant.updatedAt,
    email: inv.email,
    name: inv.name,
    role: inv.role,
    state: inv.acceptedAt ? "accepted" : inv.expiresAt < new Date() ? "expired" : "open",
  };
}

/**
 * Nimmt eine Einladung für einen Benutzer an: Mitgliedschaft anlegen (oder Rolle anheben,
 * nie herabsetzen), Einladung als angenommen markieren. Atomar gegen Doppelklick.
 */
export async function acceptInvitationForUser(invitationId: string, userId: string): Promise<{ tenantId: string; role: string } | null> {
  return db.$transaction(async (tx) => {
    const marked = await tx.invitation.updateMany({
      where: { id: invitationId, acceptedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date() },
    });
    if (marked.count !== 1) return null;
    const inv = await tx.invitation.findUniqueOrThrow({ where: { id: invitationId } });
    const existing = await tx.membership.findUnique({ where: { userId_tenantId: { userId, tenantId: inv.tenantId } } });
    const rank: Record<string, number> = { OWNER: 4, ADMIN: 3, TRAINER: 2, MEMBER: 1 };
    const today = new Date(`${todayZurich()}T00:00:00Z`);
    if (!existing) {
      await tx.membership.create({ data: { userId, tenantId: inv.tenantId, role: inv.role, status: "ACTIVE", joinedAt: today } });
    } else {
      await tx.membership.update({
        where: { id: existing.id },
        data: {
          role: (rank[inv.role] ?? 0) > (rank[existing.role] ?? 0) ? inv.role : existing.role,
          ...(existing.status === "LEFT" ? { status: "ACTIVE", leftAt: null, joinedAt: today } : {}),
          ...(existing.joinedAt ? {} : { joinedAt: today }),
        },
      });
    }
    return { tenantId: inv.tenantId, role: inv.role };
  });
}

export const SET_PASSWORD_DAYS = 14;

/**
 * Für importierte Benutzer ohne Passwort: Link «Passwort festlegen» (AuthToken INVITE, 14 Tage).
 * Frühere offene Links desselben Benutzers werden ungültig.
 */
export async function sendSetPasswordMail(userId: string, tenantId?: string | null): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, locale: true, deletedAt: true } });
  if (!user || user.deletedAt) return;
  const token = generateOpaqueToken();
  await db.$transaction([
    db.authToken.updateMany({ where: { userId, kind: "INVITE", usedAt: null }, data: { usedAt: new Date() } }),
    db.authToken.create({ data: { userId, kind: "INVITE", tokenHash: hashOpaqueToken(token), expiresAt: new Date(Date.now() + SET_PASSWORD_DAYS * DAY) } }),
  ]);
  await mailSetPassword({ tenantId: tenantId ?? null, email: user.email, name: user.name, locale: user.locale, token, days: SET_PASSWORD_DAYS });
}

/** Gültiger, unbenutzter Token einer Art (RESET oder INVITE) oder null. */
export async function findValidAuthToken(token: string, kinds: string[]) {
  if (!token || token.length > 100) return null;
  const row = await db.authToken.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
    include: { user: { select: { id: true, email: true, name: true, deletedAt: true, passwordSetAt: true, totpEnabledAt: true } } },
  });
  if (!row || !kinds.includes(row.kind) || row.usedAt || row.expiresAt < new Date() || row.user.deletedAt) return null;
  return row;
}
