import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { isTenantRole } from "@/lib/permissions";
import { todayZurich } from "@/lib/time";
import { userAvatarUrl } from "@/components/avatar";
import { MEMBER_PAGE_SIZE, dateOnly, displayEmail, isMemberStatus, isMinor, isPlaceholderEmail, type MemberFilters } from "./types";

/** Zugang zur App: Passwort gesetzt, Einladung offen, nie eingeladen oder keine E-Mail. */
export type AccessState = "password" | "invited" | "none" | "noemail";

export function accessState(u: { email: string; passwordSetAt: Date | null; openInvites: number }): AccessState {
  if (u.passwordSetAt) return "password";
  if (isPlaceholderEmail(u.email)) return "noemail";
  return u.openInvites > 0 ? "invited" : "none";
}

const openInviteWhere = () => ({ kind: "INVITE", usedAt: null, expiresAt: { gt: new Date() } });

/** «YYYY-MM-DD» minus n Jahre (29.2. → 28.2.) */
function yearsBefore(day: string, years: number) {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y! - years, m! - 1, d!));
  if (dt.getUTCMonth() !== m! - 1) dt.setUTCDate(0);
  return dt;
}

export function memberWhere(tenantId: string, f: MemberFilters): Prisma.MembershipWhereInput {
  const and: Prisma.MembershipWhereInput[] = [{ tenantId }];
  if (f.q) {
    const q = f.q.slice(0, 100);
    and.push({ OR: [{ user: { name: { contains: q } } }, { user: { email: { contains: q } } }, { memberNumber: { contains: q } }, { licenseNumber: { contains: q } }, { user: { phone: { contains: q } } }] });
  }
  if (f.status === "all") {
    // alle, auch Ausgetretene
  } else if (isMemberStatus(f.status)) and.push({ status: f.status });
  else and.push({ status: { not: "LEFT" } });
  if (f.role && isTenantRole(f.role)) and.push({ role: f.role });
  if (f.cat === "none") and.push({ feeCategoryId: null });
  else if (f.cat) and.push({ feeCategoryId: f.cat });
  if (f.hh === "none") and.push({ householdId: null });
  else if (f.hh === "any") and.push({ householdId: { not: null } });
  else if (f.hh) and.push({ householdId: f.hh });
  if (f.access === "nopw") and.push({ user: { passwordSetAt: null } });
  else if (f.access === "invited") and.push({ user: { passwordSetAt: null, authTokens: { some: openInviteWhere() } } });
  else if (f.access === "never") and.push({ user: { passwordSetAt: null, authTokens: { none: openInviteWhere() } } });
  else if (f.access === "active") and.push({ user: { passwordSetAt: { not: null } } });
  if (f.minor) and.push({ user: { birthDate: { gt: yearsBefore(todayZurich(), 18) } } });
  return { AND: and };
}

function memberOrder(sort: MemberFilters["sort"]): Prisma.MembershipOrderByWithRelationInput[] {
  const byName: Prisma.MembershipOrderByWithRelationInput = { user: { name: "asc" } };
  switch (sort) {
    case "-name": return [{ user: { name: "desc" } }];
    case "number": return [{ memberNumber: { sort: "asc", nulls: "last" } }, byName];
    case "joined": return [{ joinedAt: { sort: "asc", nulls: "last" } }, byName];
    case "-joined": return [{ joinedAt: { sort: "desc", nulls: "last" } }, byName];
    case "-created": return [{ createdAt: "desc" }];
    default: return [byName];
  }
}

export type MemberListRow = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  memberNumber: string | null;
  licenseNumber: string | null;
  category: string | null;
  household: string | null;
  joinedAt: string | null;
  minor: boolean;
  access: AccessState;
};

export async function listMembers(tenantId: string, f: MemberFilters) {
  const where = memberWhere(tenantId, f);
  const total = await db.membership.count({ where });
  const pages = Math.max(1, Math.ceil(total / MEMBER_PAGE_SIZE));
  const page = Math.min(f.page, pages);
  const rows = await db.membership.findMany({
    where,
    orderBy: memberOrder(f.sort),
    skip: (page - 1) * MEMBER_PAGE_SIZE,
    take: MEMBER_PAGE_SIZE,
    select: {
      id: true, role: true, status: true, memberNumber: true, licenseNumber: true, joinedAt: true,
      feeCategory: { select: { name: true } },
      household: { select: { name: true } },
      user: {
        select: {
          id: true, name: true, email: true, phone: true, avatarPath: true, updatedAt: true, birthDate: true, passwordSetAt: true,
          _count: { select: { authTokens: { where: openInviteWhere() } } },
        },
      },
    },
  });
  const today = todayZurich();
  const items: MemberListRow[] = rows.map((m) => ({
    id: m.id,
    userId: m.user.id,
    name: m.user.name,
    email: displayEmail(m.user.email),
    phone: m.user.phone,
    avatarUrl: userAvatarUrl(m.user),
    role: m.role,
    status: m.status,
    memberNumber: m.memberNumber,
    licenseNumber: m.licenseNumber,
    category: m.feeCategory?.name ?? null,
    household: m.household?.name ?? null,
    joinedAt: dateOnly(m.joinedAt),
    minor: isMinor(dateOnly(m.user.birthDate), today),
    access: accessState({ email: m.user.email, passwordSetAt: m.user.passwordSetAt, openInvites: m.user._count.authTokens }),
  }));
  return { items, total, page, pages };
}

/** IDs aller Treffer (für «alle auswählen»), höchstens 5000. */
export async function listMemberIds(tenantId: string, f: MemberFilters) {
  const rows = await db.membership.findMany({ where: memberWhere(tenantId, f), select: { id: true }, orderBy: memberOrder(f.sort), take: 5000 });
  return rows.map((r) => r.id);
}

export async function memberFilterOptions(tenantId: string) {
  const [categories, households, counts] = await Promise.all([
    db.feeCategory.findMany({ where: { tenantId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, amountCents: true, isActive: true } }),
    db.household.findMany({ where: { tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.membership.groupBy({ by: ["status"], where: { tenantId }, _count: { _all: true } }),
  ]);
  const statusCounts = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>;
  return { categories, households, statusCounts };
}

/** Mitglied mit allen Feldern für die Detailseite (oder null, wenn nicht in diesem Verein). */
export async function getMemberDetail(tenantId: string, membershipId: string) {
  const m = await db.membership.findFirst({
    where: { id: membershipId, tenantId },
    include: {
      feeCategory: { select: { id: true, name: true, amountCents: true } },
      household: { select: { id: true, name: true, payerUserId: true, memberships: { where: { NOT: { id: membershipId } }, select: { id: true, user: { select: { name: true } } } } } },
      user: {
        select: {
          id: true, name: true, email: true, phone: true, birthDate: true, street: true, zip: true, city: true, avatarPath: true, updatedAt: true,
          passwordSetAt: true, totpEnabledAt: true, createdAt: true, deletedAt: true,
          _count: { select: { authTokens: { where: openInviteWhere() }, memberships: true } },
        },
      },
    },
  });
  if (!m) return null;
  const [results, openFees, openBookings, openAmmo] = await Promise.all([
    db.matchParticipant.findMany({
      where: { userId: m.userId, match: { tenantId } },
      orderBy: { match: { date: "desc" } },
      take: 5,
      select: { id: true, total: true, isOfficial: true, passed: true, match: { select: { id: true, date: true, title: true, program: { select: { name: true } } } } },
    }),
    db.feeInvoice.aggregate({ where: { tenantId, status: "OPEN", OR: [{ membershipId: m.id }, { userId: m.userId }] }, _count: { _all: true }, _sum: { amountCents: true } }),
    db.invoice.count({ where: { tenantId, status: "OPEN", booking: { userId: m.userId } } }),
    db.ammoOrder.count({ where: { tenantId, userId: m.userId, paymentStatus: "UNPAID", invoiceNumber: { not: null } } }),
  ]);
  return {
    membership: m,
    access: accessState({ email: m.user.email, passwordSetAt: m.user.passwordSetAt, openInvites: m.user._count.authTokens }),
    results,
    openInvoices: { fees: openFees._count._all, feesCents: openFees._sum.amountCents ?? 0, bookings: openBookings, ammo: openAmmo },
  };
}

export async function listHouseholds(tenantId: string) {
  return db.household.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, payerUserId: true,
      memberships: {
        orderBy: { user: { name: "asc" } },
        select: { id: true, userId: true, status: true, feeAmountOverrideCents: true, feeCategory: { select: { amountCents: true } }, user: { select: { name: true, avatarPath: true, updatedAt: true, id: true } } },
      },
    },
  });
}

export async function listOpenInvitations(tenantId: string) {
  return db.invitation.findMany({
    where: { tenantId, acceptedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, email: true, name: true, role: true, expiresAt: true, createdAt: true, invitedById: true },
  });
}
