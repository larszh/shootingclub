"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { THROTTLE, clientIp, throttle } from "@/lib/auth";
import { requirePermission } from "@/lib/tenant";
import { ROLE_LABELS, isTenantRole, type TenantRole } from "@/lib/permissions";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { parseMoneyToCents } from "@/lib/money";
import { todayZurich } from "@/lib/time";
import { toCsv } from "@/modules/billing/csv";
import { removeUserFromTenantChats } from "@/modules/chat/service";
import { createInvitation, sendSetPasswordMail } from "@/modules/core/invitations";
import { profileManagedByTenant, profilesManagedByTenant } from "./ownership";
import { listMemberIds } from "./queries";
import {
  MEMBER_STATUSES,
  STATUS_LABELS,
  dateOnly,
  isMemberStatus,
  isPlaceholderEmail,
  isValidEmail,
  parseMemberFilters,
  placeholderEmail,
  statusLabel,
  toDbDate,
  type MemberStatus,
} from "./types";

const revalidateMembers = () => {
  revalidatePath("/admin/members", "layout");
  revalidatePath("/members");
  revalidatePath("/admin/billing");
};

type Ctx = Awaited<ReturnType<typeof requirePermission>>;
const actor = (ctx: Ctx) => ({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name });
const canTouchOwner = (ctx: Ctx) => ctx.user.isSuperAdmin || ctx.tenant.role === "OWNER";

const idList = z.array(z.string().min(1).max(64)).min(1, "Keine Mitglieder ausgewählt").max(5000, "Höchstens 5000 auf einmal");

// --- Mitglied bearbeiten ---------------------------------------------------------

const optText = (max: number, label: string) =>
  z.string().trim().max(max, `${label}: höchstens ${max} Zeichen`).transform((v) => v || null);
const optDate = (label: string) =>
  z.string().trim().refine((v) => !v || toDbDate(v) !== null, `${label}: ungültiges Datum`).transform((v) => (v ? v : null));

const memberSchema = z.object({
  name: z.string().trim().min(2, "Name: mindestens 2 Zeichen").max(191, "Name zu lang"),
  email: z.string().trim().toLowerCase().max(191),
  phone: optText(40, "Telefon"),
  birthDate: optDate("Geburtsdatum"),
  street: optText(80, "Strasse"),
  zip: optText(12, "PLZ"),
  city: optText(80, "Ort"),
  memberNumber: optText(40, "Mitgliedernummer"),
  licenseNumber: optText(40, "Lizenznummer"),
  status: z.enum(MEMBER_STATUSES),
  joinedAt: optDate("Eintritt"),
  leftAt: optDate("Austritt"),
  feeCategoryId: z.string().max(64).transform((v) => v || null),
  feeOverride: z.string().trim().max(20),
  householdId: z.string().max(64).transform((v) => v || null),
  guardianName: optText(191, "Name der Vertretung"),
  guardianEmail: z.string().trim().toLowerCase().max(191).refine((v) => !v || isValidEmail(v), "E-Mail der Vertretung ist ungültig").transform((v) => v || null),
  guardianPhone: optText(40, "Telefon der Vertretung"),
  adminNote: optText(5000, "Notiz"),
  workHoursExempt: z.boolean(),
});

const FIELD_NAMES: Record<string, string> = {
  name: "Name", email: "E-Mail", phone: "Telefon", birthDate: "Geburtsdatum", address: "Adresse", memberNumber: "Mitgliedernummer",
  licenseNumber: "Lizenznummer", status: "Status", joinedAt: "Eintritt", leftAt: "Austritt", feeCategoryId: "Beitragskategorie",
  feeAmountOverrideCents: "Individueller Beitrag", householdId: "Haushalt", guardian: "Gesetzliche Vertretung", adminNote: "Notiz",
  workHoursExempt: "Arbeitsstunden-Befreiung",
};

export async function updateMemberAction(membershipId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission("members.manage");
  const parsed = memberSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    birthDate: formData.get("birthDate") ?? "",
    street: formData.get("street") ?? "",
    zip: formData.get("zip") ?? "",
    city: formData.get("city") ?? "",
    memberNumber: formData.get("memberNumber") ?? "",
    licenseNumber: formData.get("licenseNumber") ?? "",
    status: formData.get("status") ?? "ACTIVE",
    joinedAt: formData.get("joinedAt") ?? "",
    leftAt: formData.get("leftAt") ?? "",
    feeCategoryId: formData.get("feeCategoryId") ?? "",
    feeOverride: formData.get("feeOverride") ?? "",
    householdId: formData.get("householdId") ?? "",
    guardianName: formData.get("guardianName") ?? "",
    guardianEmail: formData.get("guardianEmail") ?? "",
    guardianPhone: formData.get("guardianPhone") ?? "",
    adminNote: formData.get("adminNote") ?? "",
    workHoursExempt: formData.get("workHoursExempt") === "on",
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return fail(parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen.", fe);
  }
  const v = parsed.data;
  const m = await db.membership.findFirst({ where: { id: membershipId, tenantId: ctx.tenant.id }, include: { user: true } });
  if (!m) return fail("Mitglied nicht gefunden.");

  // Schutzregeln wie bei Rollen: Inhaber nur durch Inhaber, niemand sperrt sich selbst aus.
  if (v.status === "LEFT" && m.status !== "LEFT") {
    if (m.role === "OWNER") return fail("Inhaber können nicht als ausgetreten markiert werden. Zuerst die Rolle ändern.", { status: "Nicht möglich für Inhaber" });
    if (m.userId === ctx.user.id) return fail("Du kannst dich nicht selbst als ausgetreten markieren.", { status: "Nicht möglich" });
  }
  if (m.role === "OWNER" && !canTouchOwner(ctx) && m.status !== v.status) return fail("Nur Inhaber können den Status von Inhabern ändern.");

  // Personendaten gehören der Person. Der Verein ändert sie nur, wenn er das Konto allein verwaltet
  // (kein eigenes Passwort, in keinem weiteren Verein aktiv) – sonst könnte ein beliebiger Verein
  // Daten oder Login-Adresse eines fremden Kontos überschreiben. Sonst bleiben die bisherigen Werte.
  const ownsProfile = ctx.user.isSuperAdmin || (await profileManagedByTenant(m.userId, ctx.tenant.id));
  const p = ownsProfile ? v : { ...v, name: m.user.name, phone: m.user.phone, birthDate: dateOnly(m.user.birthDate), street: m.user.street, zip: m.user.zip, city: m.user.city };

  // E-Mail (= Login): nur bei Konten ohne eigenes Passwort, die dieser Verein allein verwaltet.
  let email = m.user.email;
  const emailEditable = ownsProfile && !m.user.passwordSetAt && !m.user.deletedAt;
  if (v.email !== (isPlaceholderEmail(m.user.email) ? "" : m.user.email)) {
    if (!emailEditable) {
      return fail(
        m.user.passwordSetAt
          ? "Die E-Mail ändert die Person selbst in ihrem Profil (sie hat bereits ein Passwort)."
          : "Die E-Mail ist nicht änderbar: Das Konto gehört auch zu einem anderen Verein. Die Person ändert sie selbst in ihrem Profil.",
        { email: "Nicht änderbar" },
      );
    }
    if (!v.email) email = placeholderEmail(m.user.id);
    else {
      if (!isValidEmail(v.email)) return fail("Ungültige E-Mail-Adresse.", { email: "Ungültig" });
      const taken = await db.user.findUnique({ where: { email: v.email }, select: { id: true } });
      if (taken && taken.id !== m.user.id) return fail("Diese E-Mail gehört bereits zu einem anderen Konto. Stattdessen einladen oder Dublette entfernen.", { email: "Bereits vergeben" });
      email = v.email;
    }
  }

  if (v.feeCategoryId) {
    const c = await db.feeCategory.findFirst({ where: { id: v.feeCategoryId, tenantId: ctx.tenant.id }, select: { id: true } });
    if (!c) return fail("Beitragskategorie nicht gefunden.");
  }
  if (v.householdId) {
    const h = await db.household.findFirst({ where: { id: v.householdId, tenantId: ctx.tenant.id }, select: { id: true } });
    if (!h) return fail("Haushalt nicht gefunden.");
  }
  let override: number | null = null;
  if (v.feeOverride) {
    const raw = v.feeOverride.replace(/^(CHF|Fr\.?)\s*/i, "").replace(/['’\s]/g, "").replace(/\.[-–]$/, "");
    if (!/^\d+([.,]\d{1,2})?$/.test(raw)) return fail("Ungültiger Beitrag, z.B. «80» oder «45.50».", { feeOverride: "Ungültiger Betrag" });
    override = parseMoneyToCents(raw);
    if (override > 100_000_00) return fail("Ungültiger Beitrag.", { feeOverride: "Zu hoch" });
  }

  const today = todayZurich();
  let leftAt = v.leftAt;
  if (v.status === "LEFT" && !leftAt) leftAt = today;
  // Wieder eingetreten: vergangenes Austrittsdatum entfernen (geplanter Austritt in der Zukunft bleibt).
  if (v.status !== "LEFT" && m.status === "LEFT" && leftAt && leftAt <= today) leftAt = null;

  const userData = { name: p.name, email, phone: p.phone, birthDate: toDbDate(p.birthDate), street: p.street, zip: p.zip, city: p.city };
  const memberData = {
    memberNumber: v.memberNumber, licenseNumber: v.licenseNumber, status: v.status, joinedAt: toDbDate(v.joinedAt), leftAt: toDbDate(leftAt),
    feeCategoryId: v.feeCategoryId, feeAmountOverrideCents: override, householdId: v.householdId,
    guardianName: v.guardianName, guardianEmail: v.guardianEmail, guardianPhone: v.guardianPhone, adminNote: v.adminNote, workHoursExempt: v.workHoursExempt,
  };

  // Geänderte Felder fürs Protokoll (nur Feldnamen, Status mit Werten – keine Personendaten im Log).
  const changed: string[] = [];
  if (m.user.name !== p.name) changed.push(FIELD_NAMES.name!);
  if (m.user.email !== email) changed.push(FIELD_NAMES.email!);
  if (m.user.phone !== p.phone) changed.push(FIELD_NAMES.phone!);
  if (dateOnly(m.user.birthDate) !== p.birthDate) changed.push(FIELD_NAMES.birthDate!);
  if (m.user.street !== p.street || m.user.zip !== p.zip || m.user.city !== p.city) changed.push(FIELD_NAMES.address!);
  if (m.memberNumber !== v.memberNumber) changed.push(FIELD_NAMES.memberNumber!);
  if (m.licenseNumber !== v.licenseNumber) changed.push(FIELD_NAMES.licenseNumber!);
  if (m.status !== v.status) changed.push(`Status ${statusLabel(m.status)} → ${statusLabel(v.status)}`);
  if (dateOnly(m.joinedAt) !== v.joinedAt) changed.push(FIELD_NAMES.joinedAt!);
  if (dateOnly(m.leftAt) !== leftAt) changed.push(FIELD_NAMES.leftAt!);
  if (m.feeCategoryId !== v.feeCategoryId) changed.push(FIELD_NAMES.feeCategoryId!);
  if (m.feeAmountOverrideCents !== override) changed.push(FIELD_NAMES.feeAmountOverrideCents!);
  if (m.householdId !== v.householdId) changed.push(FIELD_NAMES.householdId!);
  if (m.guardianName !== v.guardianName || m.guardianEmail !== v.guardianEmail || m.guardianPhone !== v.guardianPhone) changed.push(FIELD_NAMES.guardian!);
  if (m.adminNote !== v.adminNote) changed.push(FIELD_NAMES.adminNote!);
  if (m.workHoursExempt !== v.workHoursExempt) changed.push(FIELD_NAMES.workHoursExempt!);
  if (!changed.length) return ok(undefined, "Keine Änderungen.");

  const emailChanged = m.user.email !== email;
  try {
    await db.$transaction([
      // Nur bei eigenen Konten schreiben; sonst bleibt die Person unangetastet.
      ...(ownsProfile ? [db.user.update({ where: { id: m.userId }, data: userData })] : []),
      db.membership.update({ where: { id: m.id }, data: memberData }),
      // Neue Adresse: an die alte Adresse verschickte Links (Passwort festlegen/zurücksetzen) und
      // allfällige Sitzungen werden ungültig.
      ...(emailChanged
        ? [
            db.authToken.updateMany({ where: { userId: m.userId, kind: { in: ["INVITE", "RESET"] }, usedAt: null }, data: { usedAt: new Date() } }),
            db.session.deleteMany({ where: { userId: m.userId } }),
          ]
        : []),
    ]);
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return fail("Diese E-Mail gehört bereits zu einem anderen Konto.", { email: "Bereits vergeben" });
    throw e;
  }
  if (v.status === "LEFT" && m.status !== "LEFT") await dropChats(m.userId, ctx.tenant.id);
  await fixHouseholdPayer(m.householdId);

  await audit({ ...actor(ctx), action: "member.update", entity: "Membership", entityId: m.id, detail: `${p.name}: ${changed.join(", ")}` });
  revalidateMembers();
  return ok(undefined, "Gespeichert.");
}

async function dropChats(userId: string, tenantId: string) {
  try {
    await removeUserFromTenantChats(userId, tenantId);
  } catch (e) {
    console.error("Chat-Mitgliedschaften konnten nicht entfernt werden:", e);
  }
}

/** Zahler eines Haushalts muss Mitglied des Haushalts sein; sonst erstes verbleibendes Mitglied. */
async function fixHouseholdPayer(householdId: string | null) {
  if (!householdId) return;
  const h = await db.household.findUnique({ where: { id: householdId }, select: { payerUserId: true, memberships: { select: { userId: true }, orderBy: { createdAt: "asc" } } } });
  if (!h) return;
  if (h.payerUserId && h.memberships.some((m) => m.userId === h.payerUserId)) return;
  await db.household.update({ where: { id: householdId }, data: { payerUserId: h.memberships[0]?.userId ?? null } });
}

// --- Sammelaktionen ----------------------------------------------------------------

async function membershipsIn(tenantId: string, ids: string[]) {
  return db.membership.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, userId: true, role: true, status: true, user: { select: { name: true } } } });
}

/**
 * Ein Protokolleintrag pro betroffener Mitgliedschaft (mit entityId), damit Sammelaktionen auch in
 * den «Änderungen» des einzelnen Mitglieds erscheinen. Wirft nie (wie audit()).
 */
async function auditEach(ctx: Ctx, action: string, entries: Array<{ id: string; detail: string }>) {
  if (!entries.length) return;
  let ip: string | null = null;
  try {
    const v = await clientIp();
    ip = v === "unknown" ? null : v.slice(0, 64);
  } catch {
    // ausserhalb eines Requests
  }
  try {
    await db.auditLog.createMany({
      data: entries.map((e) => ({
        tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name.slice(0, 191), action, entity: "Membership", entityId: e.id, detail: e.detail.slice(0, 2000), ip,
      })),
    });
  } catch (err) {
    console.error("[audit] Einträge fehlgeschlagen:", action, err instanceof Error ? err.message : err);
  }
}

export async function bulkSetStatusAction(ids: string[], status: string): Promise<ActionResult<{ count: number }>> {
  const ctx = await requirePermission("members.manage");
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Auswahl");
  if (!isMemberStatus(status)) return fail("Ungültiger Status");
  const rows = await membershipsIn(ctx.tenant.id, parsed.data);
  let skipped = 0;
  const targets = rows.filter((m) => {
    if (m.status === status) return false;
    const blocked = (status === "LEFT" && (m.role === "OWNER" || m.userId === ctx.user.id)) || (m.role === "OWNER" && !canTouchOwner(ctx));
    if (blocked) skipped++;
    return !blocked;
  });
  if (!targets.length) {
    if (!skipped) return ok({ count: 0 }, "Keine Änderung.");
    return fail(status === "LEFT" ? "Inhaber und du selbst können nicht als ausgetreten markiert werden." : "Nur Inhaber können den Status von Inhabern ändern.");
  }
  const today = toDbDate(todayZurich());
  const targetIds = targets.map((m) => m.id);
  if (status === "LEFT") {
    await db.membership.updateMany({ where: { id: { in: targetIds }, tenantId: ctx.tenant.id, leftAt: null }, data: { leftAt: today } });
    await db.membership.updateMany({ where: { id: { in: targetIds }, tenantId: ctx.tenant.id }, data: { status } });
    for (const m of targets) await dropChats(m.userId, ctx.tenant.id);
  } else {
    // Rückkehr aus «Ausgetreten»: Austrittsdatum in der Vergangenheit entfernen
    await db.membership.updateMany({ where: { id: { in: targetIds }, tenantId: ctx.tenant.id, status: "LEFT", leftAt: { lte: today! } }, data: { leftAt: null } });
    await db.membership.updateMany({ where: { id: { in: targetIds }, tenantId: ctx.tenant.id }, data: { status } });
  }
  await auditEach(ctx, "member.status", targets.map((m) => ({ id: m.id, detail: `${m.user.name}: Status ${statusLabel(m.status)} → ${statusLabel(status)}` })));
  revalidateMembers();
  return ok({ count: targets.length }, `${targets.length} ${targets.length === 1 ? "Mitglied" : "Mitglieder"} auf «${STATUS_LABELS[status as MemberStatus]}» gesetzt${skipped ? `, ${skipped} übersprungen` : ""}.`);
}

export async function bulkSetCategoryAction(ids: string[], categoryId: string | null): Promise<ActionResult<{ count: number }>> {
  const ctx = await requirePermission("members.manage");
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Auswahl");
  let name = "keine";
  if (categoryId) {
    const c = await db.feeCategory.findFirst({ where: { id: categoryId, tenantId: ctx.tenant.id }, select: { name: true } });
    if (!c) return fail("Kategorie nicht gefunden");
    name = c.name;
  }
  const before = await db.membership.findMany({
    where: { tenantId: ctx.tenant.id, id: { in: parsed.data } },
    select: { id: true, feeCategoryId: true, feeCategory: { select: { name: true } }, user: { select: { name: true } } },
  });
  const res = await db.membership.updateMany({ where: { tenantId: ctx.tenant.id, id: { in: parsed.data } }, data: { feeCategoryId: categoryId } });
  await auditEach(ctx, "member.category", before
    .filter((m) => m.feeCategoryId !== categoryId)
    .map((m) => ({ id: m.id, detail: `${m.user.name}: Beitragskategorie «${m.feeCategory?.name ?? "keine"}» → «${name}»` })));
  revalidateMembers();
  return ok({ count: res.count }, `Kategorie für ${res.count} ${res.count === 1 ? "Mitglied" : "Mitglieder"} gesetzt.`);
}

/**
 * Zugangsmail an Mitglieder ohne Passwort («Passwort festlegen», 14 Tage gültig).
 * Übersprungen: Mitglieder mit Passwort, ohne E-Mail und Ausgetretene.
 */
export async function bulkSendAccessMailAction(ids: string[]): Promise<ActionResult<{ sent: number; skipped: number }>> {
  const ctx = await requirePermission("members.manage");
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Auswahl");
  const limited = throttle(`members-mail:${ctx.tenant.id}`, 20, 60 * 60_000);
  if (limited) return fail(limited);
  const rows = await db.membership.findMany({
    where: { tenantId: ctx.tenant.id, id: { in: parsed.data } },
    select: { status: true, user: { select: { id: true, email: true, passwordSetAt: true, deletedAt: true } } },
  });
  // Nur Konten, die dieser Verein allein verwaltet: Konten aus weiteren Vereinen holen sich den
  // Zugang selbst («Passwort vergessen» an ihre eigene Adresse).
  const own = await profilesManagedByTenant(rows.map((m) => m.user.id), ctx.tenant.id);
  let sent = 0;
  let failed = 0;
  for (const m of rows) {
    if (m.status === "LEFT" || m.user.passwordSetAt || m.user.deletedAt || isPlaceholderEmail(m.user.email) || !own.has(m.user.id)) continue;
    try {
      await sendSetPasswordMail(m.user.id, ctx.tenant.id);
      sent++;
    } catch (e) {
      failed++;
      console.error("Zugangsmail fehlgeschlagen:", (e as Error).message);
    }
  }
  const skipped = parsed.data.length - sent - failed;
  await audit({ ...actor(ctx), action: "member.access.mail", entity: "Membership", detail: `${sent} Zugangsmails, ${skipped} übersprungen${failed ? `, ${failed} fehlgeschlagen` : ""}` });
  revalidateMembers();
  const msg = sent
    ? `${sent} ${sent === 1 ? "Mail" : "Mails"} mit Link zum Passwort-Setzen verschickt.${skipped ? ` ${skipped} übersprungen (hat schon Zugang, keine E-Mail, ausgetreten oder Konto auch in einem anderen Verein).` : ""}`
    : "Keine Mail verschickt: Alle Ausgewählten haben bereits Zugang, keine E-Mail, sind ausgetreten oder haben ein Konto, das auch zu einem anderen Verein gehört.";
  return ok({ sent, skipped }, msg);
}

export async function sendAccessMailAction(membershipId: string): Promise<ActionResult> {
  const res = await bulkSendAccessMailAction([membershipId]);
  if (!res.ok) return res;
  return res.data?.sent
    ? ok(undefined, "Mail mit Link zum Passwort-Setzen verschickt.")
    : fail("Keine Mail verschickt: hat bereits Zugang, keine E-Mail, ist ausgetreten oder das Konto gehört auch zu einem anderen Verein (dann «Passwort vergessen» auf der Anmeldeseite).");
}

/** Alle Treffer der aktuellen Filter (Query-String der Liste) – für «alle auswählen». */
export async function selectAllMatchingAction(query: string): Promise<ActionResult<{ ids: string[] }>> {
  const ctx = await requirePermission("members.view");
  if (typeof query !== "string" || query.length > 2000) return fail("Ungültige Filter");
  const filters = parseMemberFilters(Object.fromEntries(new URLSearchParams(query.replace(/^\?/, ""))));
  return ok({ ids: await listMemberIds(ctx.tenant.id, filters) });
}

/** CSV (Semikolon, UTF-8 mit BOM) der Auswahl. Wird im Browser als Datei gespeichert. */
export async function exportMembersCsvAction(ids: string[]): Promise<ActionResult<{ filename: string; csv: string }>> {
  const ctx = await requirePermission("members.view");
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Auswahl");
  const rows = await db.membership.findMany({
    where: { tenantId: ctx.tenant.id, id: { in: parsed.data } },
    orderBy: { user: { name: "asc" } },
    select: {
      role: true, status: true, memberNumber: true, licenseNumber: true, joinedAt: true, leftAt: true, feeAmountOverrideCents: true,
      guardianName: true, guardianEmail: true, guardianPhone: true,
      feeCategory: { select: { name: true } }, household: { select: { name: true } },
      user: { select: { name: true, email: true, phone: true, street: true, zip: true, city: true, birthDate: true, passwordSetAt: true } },
    },
  });
  const fmt = (d: Date | null) => {
    const s = dateOnly(d);
    return s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : "";
  };
  const csv = toCsv([
    ["Name", "E-Mail", "Telefon", "Strasse", "PLZ", "Ort", "Geburtsdatum", "Mitgliedernummer", "Lizenznummer", "Status", "Rolle", "Eintritt", "Austritt", "Beitragskategorie", "Individueller Beitrag", "Haushalt", "Gesetzliche Vertretung", "E-Mail Vertretung", "Telefon Vertretung", "Zugang"],
    ...rows.map((m) => [
      m.user.name,
      isPlaceholderEmail(m.user.email) ? "" : m.user.email,
      m.user.phone,
      m.user.street,
      m.user.zip,
      m.user.city,
      fmt(m.user.birthDate),
      m.memberNumber,
      m.licenseNumber,
      statusLabel(m.status),
      ROLE_LABELS[m.role as TenantRole] ?? m.role,
      fmt(m.joinedAt),
      fmt(m.leftAt),
      m.feeCategory?.name,
      m.feeAmountOverrideCents != null ? (m.feeAmountOverrideCents / 100).toFixed(2) : "",
      m.household?.name,
      m.guardianName,
      m.guardianEmail,
      m.guardianPhone,
      m.user.passwordSetAt ? "ja" : "nein",
    ]),
  ]);
  await audit({ ...actor(ctx), action: "member.export", entity: "Membership", detail: `${rows.length} Mitglieder als CSV exportiert` });
  return ok({ filename: `mitglieder-${todayZurich()}.csv`, csv });
}

// --- Einladungen ------------------------------------------------------------------

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().max(191).refine(isValidEmail, "Bitte eine gültige E-Mail-Adresse eingeben"),
  name: z.string().trim().max(191).optional(),
  role: z.string().refine((r) => isTenantRole(r) && r !== "OWNER", "Ungültige Rolle"),
});

export async function inviteMemberAction(_prev: ActionResult<{ url: string }> | null, formData: FormData): Promise<ActionResult<{ url: string }>> {
  const ctx = await requirePermission("members.manage");
  const parsed = inviteSchema.safeParse({ email: formData.get("email") ?? "", name: formData.get("name") || undefined, role: formData.get("role") ?? "MEMBER" });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe", fe);
  }
  const limited = throttle(`members-invite:${ctx.tenant.id}`, THROTTLE.joinCode.limit * 10, 60 * 60_000);
  if (limited) return fail(limited);
  const { email, name, role } = parsed.data;
  if (role === "ADMIN" && !ctx.can("tenant.manage")) return fail("Nur Admins können Admins einladen.");
  const existing = await db.membership.findFirst({ where: { tenantId: ctx.tenant.id, user: { email } }, select: { status: true, userId: true, user: { select: { passwordSetAt: true } } } });
  if (existing && existing.status !== "LEFT") {
    return fail(existing.user.passwordSetAt
      ? "Diese Person ist bereits Mitglied."
      : "Diese Person ist bereits als Mitglied erfasst, hat aber noch kein Passwort. In der Mitgliederliste «Zugangsmail senden» wählen.", { email: "Bereits Mitglied" });
  }
  const inv = await createInvitation({ tenantId: ctx.tenant.id, email, name: name || null, role, invitedById: ctx.user.id, sendMail: true });
  await audit({ ...actor(ctx), action: "member.invite", entity: "Invitation", entityId: inv.id, detail: `Einladung als ${ROLE_LABELS[role as TenantRole]}` });
  revalidatePath("/admin/members/invitations");
  return ok({ url: inv.url }, `Einladung an ${email} verschickt.`);
}

export async function resendInvitationAction(id: string): Promise<ActionResult<{ url: string }>> {
  const ctx = await requirePermission("members.manage");
  const inv = await db.invitation.findFirst({ where: { id, tenantId: ctx.tenant.id, acceptedAt: null } });
  if (!inv) return fail("Einladung nicht gefunden.");
  const limited = throttle(`members-invite:${ctx.tenant.id}`, THROTTLE.joinCode.limit * 10, 60 * 60_000);
  if (limited) return fail(limited);
  // createInvitation ersetzt die offene Einladung (neuer Link, neue Frist)
  const next = await createInvitation({ tenantId: ctx.tenant.id, email: inv.email, name: inv.name, role: inv.role, invitedById: ctx.user.id, sendMail: true });
  await audit({ ...actor(ctx), action: "member.invite.resend", entity: "Invitation", entityId: next.id });
  revalidatePath("/admin/members/invitations");
  return ok({ url: next.url }, `Einladung an ${inv.email} erneut verschickt.`);
}

export async function revokeInvitationAction(id: string): Promise<ActionResult> {
  const ctx = await requirePermission("members.manage");
  const res = await db.invitation.deleteMany({ where: { id, tenantId: ctx.tenant.id, acceptedAt: null } });
  if (!res.count) return fail("Einladung nicht gefunden.");
  await audit({ ...actor(ctx), action: "member.invite.revoke", entity: "Invitation", entityId: id });
  revalidatePath("/admin/members/invitations");
  return ok(undefined, "Einladung zurückgezogen.");
}

// --- Haushalte ------------------------------------------------------------------------

const householdName = z.string().trim().min(2, "Name: mindestens 2 Zeichen").max(120, "Name zu lang");

export async function createHouseholdAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await requirePermission("members.manage");
  const parsed = householdName.safeParse(formData.get("name") ?? "");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültiger Name", { name: parsed.error.issues[0]?.message ?? "" });
  const memberIds = formData.getAll("memberId").map(String).filter(Boolean).slice(0, 20);
  const found = memberIds.length ? await db.membership.findMany({ where: { tenantId: ctx.tenant.id, id: { in: memberIds } }, select: { id: true, userId: true, householdId: true, user: { select: { name: true } } } }) : [];
  // Reihenfolge der Auswahl beibehalten: die zuerst gewählte Person zahlt (wie im Formular angezeigt).
  const members = memberIds.map((id) => found.find((m) => m.id === id)).filter((m): m is (typeof found)[number] => !!m);
  const h = await db.household.create({ data: { tenantId: ctx.tenant.id, name: parsed.data, payerUserId: members[0]?.userId ?? null } });
  if (members.length) {
    await db.membership.updateMany({ where: { tenantId: ctx.tenant.id, id: { in: members.map((m) => m.id) } }, data: { householdId: h.id } });
    for (const old of new Set(members.map((m) => m.householdId).filter((x): x is string => !!x))) await fixHouseholdPayer(old);
  }
  await audit({
    ...actor(ctx), action: "household.create", entity: "Household", entityId: h.id,
    detail: `${parsed.data} (${members.length} Mitglieder${members.length ? `: ${members.map((m) => m.user.name).join(", ")}; zahlt: ${members[0]!.user.name}` : ""})`,
  });
  revalidateMembers();
  return ok({ id: h.id }, `Haushalt «${parsed.data}» angelegt.`);
}

export async function renameHouseholdAction(id: string, name: string): Promise<ActionResult> {
  const ctx = await requirePermission("members.manage");
  const parsed = householdName.safeParse(name);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültiger Name");
  const res = await db.household.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: { name: parsed.data } });
  if (!res.count) return fail("Haushalt nicht gefunden.");
  revalidateMembers();
  return ok(undefined, "Umbenannt.");
}

export async function deleteHouseholdAction(id: string): Promise<ActionResult> {
  const ctx = await requirePermission("members.manage");
  const h = await db.household.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { name: true } });
  if (!h) return fail("Haushalt nicht gefunden.");
  // Mitglieder bleiben erhalten (householdId wird per onDelete: SetNull geleert).
  await db.household.delete({ where: { id } });
  await audit({ ...actor(ctx), action: "household.delete", entity: "Household", entityId: id, detail: h.name });
  revalidateMembers();
  return ok(undefined, `Haushalt «${h.name}» aufgelöst.`);
}

export async function addToHouseholdAction(householdId: string, membershipId: string): Promise<ActionResult> {
  const ctx = await requirePermission("members.manage");
  const [h, m] = await Promise.all([
    db.household.findFirst({ where: { id: householdId, tenantId: ctx.tenant.id }, select: { id: true, name: true, payerUserId: true } }),
    db.membership.findFirst({ where: { id: membershipId, tenantId: ctx.tenant.id }, select: { id: true, userId: true, householdId: true, user: { select: { name: true } } } }),
  ]);
  if (!h || !m) return fail("Nicht gefunden.");
  if (m.householdId === h.id) return ok();
  await db.membership.update({ where: { id: m.id }, data: { householdId: h.id } });
  if (!h.payerUserId) await db.household.update({ where: { id: h.id }, data: { payerUserId: m.userId } });
  await fixHouseholdPayer(m.householdId);
  await audit({ ...actor(ctx), action: "household.member.add", entity: "Household", entityId: h.id, detail: `${m.user.name} → Haushalt «${h.name}»` });
  revalidateMembers();
  return ok(undefined, "Hinzugefügt.");
}

export async function removeFromHouseholdAction(membershipId: string): Promise<ActionResult> {
  const ctx = await requirePermission("members.manage");
  const m = await db.membership.findFirst({ where: { id: membershipId, tenantId: ctx.tenant.id }, select: { id: true, householdId: true, user: { select: { name: true } }, household: { select: { name: true } } } });
  if (!m?.householdId) return fail("Nicht gefunden.");
  await db.membership.update({ where: { id: m.id }, data: { householdId: null } });
  await fixHouseholdPayer(m.householdId);
  await audit({ ...actor(ctx), action: "household.member.remove", entity: "Household", entityId: m.householdId, detail: `${m.user.name} aus Haushalt «${m.household?.name ?? "?"}» entfernt` });
  revalidateMembers();
  return ok(undefined, "Entfernt.");
}

export async function setHouseholdPayerAction(householdId: string, userId: string): Promise<ActionResult> {
  const ctx = await requirePermission("members.manage");
  const m = await db.membership.findFirst({ where: { tenantId: ctx.tenant.id, householdId, userId }, select: { id: true, user: { select: { name: true } }, household: { select: { name: true } } } });
  if (!m) return fail("Die zahlende Person muss zum Haushalt gehören.");
  await db.household.update({ where: { id: householdId }, data: { payerUserId: userId } });
  await audit({ ...actor(ctx), action: "household.payer", entity: "Household", entityId: householdId, detail: `Haushalt «${m.household?.name ?? "?"}»: zahlt neu ${m.user.name}` });
  revalidateMembers();
  return ok(undefined, "Zahler gesetzt.");
}
