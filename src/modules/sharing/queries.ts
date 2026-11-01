import "server-only";
import { db } from "@/lib/db";
import { MODULES, type ModuleKey } from "@/lib/modules";
import type { AppContext, ActiveTenant } from "@/lib/tenant";
import { getBookingSettings, getResource, toResourceView, type BookingSettingsView, type ResourceView } from "@/modules/bookings/queries";
import { checkGuestShare, partnerReport, type ShareCheck } from "./logic";

type TenantCtx = AppContext & { tenant: ActiveTenant };

/** Modul eines beliebigen Vereins aktiv? (gleiche Regel wie getAppContext: Standard + Einstellungen) */
export async function tenantModuleEnabled(tenantId: string, key: ModuleKey) {
  const row = await db.tenantModule.findUnique({ where: { tenantId_moduleKey: { tenantId, moduleKey: key } }, select: { enabled: true } });
  if (row) return row.enabled;
  return MODULES.find((m) => m.key === key)?.defaultEnabled ?? false;
}

/** Vereine mit aktivem Modul aus einer Liste (eine Abfrage). */
async function tenantsWithModule(tenantIds: string[], key: ModuleKey) {
  if (!tenantIds.length) return new Set<string>();
  const rows = await db.tenantModule.findMany({ where: { tenantId: { in: tenantIds }, moduleKey: key }, select: { tenantId: true, enabled: true } });
  const byTenant = new Map(rows.map((r) => [r.tenantId, r.enabled]));
  const def = MODULES.find((m) => m.key === key)?.defaultEnabled ?? false;
  return new Set(tenantIds.filter((id) => byTenant.get(id) ?? def));
}

// ---------------------------------------------------------------------------
// Eigentümer
// ---------------------------------------------------------------------------

/** Freigaben einer eigenen Ressource (nur Verwaltung des Eigentümers aufrufen). */
export async function listResourceShares(ownerTenantId: string, resourceId: string) {
  return db.resourceShare.findMany({
    where: { resourceId, resource: { tenantId: ownerTenantId } },
    include: { guestTenant: { select: { id: true, name: true, slug: true, city: true, deletedAt: true } } },
    orderBy: { createdAt: "asc" },
  });
}
export type ResourceShareRow = Awaited<ReturnType<typeof listResourceShares>>[number];

/** Anzahl Freigaben pro Ressource (Ressourcenliste). */
export async function shareCountsByResource(ownerTenantId: string) {
  const rows = await db.resourceShare.groupBy({ by: ["resourceId"], where: { resource: { tenantId: ownerTenantId } }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.resourceId, r._count._all])) as Record<string, number>;
}

/** Namen der Partnervereine für Abzeichen in Listen und Kalender. */
export async function partnerNameMap(tenantIds: Array<string | null | undefined>) {
  const ids = [...new Set(tenantIds.filter((x): x is string => !!x))];
  if (!ids.length) return {} as Record<string, string>;
  const rows = await db.tenant.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return Object.fromEntries(rows.map((t) => [t.id, t.name])) as Record<string, string>;
}

/** Buchungen von Partnervereinen in einem Zeitraum (Auswertung für die Kostenaufteilung). */
export async function loadPartnerReport(ownerTenantId: string, from: Date, to: Date) {
  const list = await db.booking.findMany({
    where: { tenantId: ownerTenantId, viaTenantId: { not: null }, startsAt: { gte: from, lt: to } },
    select: { id: true, viaTenantId: true, status: true, durationMinutes: true, persons: true, totalCents: true, paymentStatus: true, currency: true },
    take: 50_000,
  });
  const names = await partnerNameMap(list.map((b) => b.viaTenantId));
  return { ...partnerReport(list, names), currency: list[0]?.currency ?? "CHF" };
}

// ---------------------------------------------------------------------------
// Gast
// ---------------------------------------------------------------------------

export type SharedResourceGroup = {
  owner: { id: string; name: string; slug: string; city: string | null };
  resources: Array<ResourceView & { priceFactorPercent: number; shareNote: string | null }>;
};

/**
 * Für den Gastverein freigegebene, buchbare Ressourcen anderer Vereine, gruppiert nach Eigentümer.
 * Nur aktive Ressourcen, Eigentümer nicht gelöscht und mit aktivem Modul «Reservationen».
 */
export async function listSharedResourcesForGuest(guestTenantId: string, opts?: { ownerSlug?: string }): Promise<SharedResourceGroup[]> {
  const shares = await db.resourceShare.findMany({
    where: {
      guestTenantId,
      canBook: true,
      resource: { isActive: true, tenantId: { not: guestTenantId }, tenant: { deletedAt: null, ...(opts?.ownerSlug ? { slug: opts.ownerSlug } : {}) } },
    },
    include: { resource: { include: { tenant: { select: { id: true, name: true, slug: true, city: true } } } } },
  });
  const enabled = await tenantsWithModule([...new Set(shares.map((s) => s.resource.tenantId))], "bookings");
  const groups = new Map<string, SharedResourceGroup>();
  for (const s of shares) {
    const owner = s.resource.tenant;
    if (!enabled.has(owner.id)) continue;
    const view = toResourceView(s.resource);
    const g = groups.get(owner.id) ?? { owner, resources: [] };
    g.resources.push({ ...view, priceFactorPercent: s.priceFactorPercent, shareNote: s.note });
    groups.set(owner.id, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, resources: g.resources.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de-CH")) }))
    .sort((a, b) => a.owner.name.localeCompare(b.owner.name, "de-CH"));
}

export type GuestShare = {
  owner: { id: string; name: string; slug: string };
  resource: ResourceView;
  settings: BookingSettingsView;
  priceFactorPercent: number;
  ownerHasRange: boolean;
};

/**
 * Prüft für jede Gast-Aktion die Freigabe: Ressource gehört dem Eigentümer, Freigabe für den aktiven
 * Verein des Mitglieds mit «darf buchen», Eigentümer aktiv. Liefert die Regeln des Eigentümers.
 */
export async function resolveGuestShare(ctx: TenantCtx, resourceId: string): Promise<({ ok: true } & GuestShare) | Extract<ShareCheck, { ok: false }>> {
  if (typeof resourceId !== "string" || !resourceId || resourceId.length > 40) return { ok: false, error: "Ressource nicht gefunden." };
  const res = await db.resource.findUnique({
    where: { id: resourceId },
    select: { id: true, tenantId: true, isActive: true, tenant: { select: { id: true, name: true, slug: true, deletedAt: true } } },
  });
  const share = res ? await db.resourceShare.findUnique({ where: { resourceId_guestTenantId: { resourceId, guestTenantId: ctx.tenant.id } } }) : null;
  const [bookingsEnabled, ownerHasRange] = res ? await Promise.all([tenantModuleEnabled(res.tenantId, "bookings"), tenantModuleEnabled(res.tenantId, "range")]) : [false, false];
  const check = checkGuestShare({
    guestRole: ctx.tenant.role,
    guestTenantId: ctx.tenant.id,
    resourceId,
    resource: res ? { tenantId: res.tenantId, isActive: res.isActive } : null,
    owner: res ? { id: res.tenant.id, deletedAt: res.tenant.deletedAt, bookingsEnabled } : null,
    share,
  });
  if (!check.ok) return check;
  const [resource, settings] = await Promise.all([getResource(res!.tenantId, resourceId), getBookingSettings(res!.tenantId)]);
  if (!resource) return { ok: false, error: "Ressource nicht gefunden." };
  return { ok: true, owner: { id: res!.tenant.id, name: res!.tenant.name, slug: res!.tenant.slug }, resource, settings, priceFactorPercent: share!.priceFactorPercent, ownerHasRange };
}

/** Eigene Partner-Buchung als Vorlage für «Wiederholen» (nur gebucht über den aktiven Verein). */
export async function getGuestRepeatSource(ctx: TenantCtx, bookingId: string) {
  if (!bookingId || bookingId.length > 40) return null;
  const b = await db.booking.findUnique({ where: { id: bookingId }, select: { id: true, tenantId: true, userId: true, viaTenantId: true, resourceId: true, durationMinutes: true, startsAt: true, persons: true } });
  if (!b || b.userId !== ctx.user.id || b.viaTenantId !== ctx.tenant.id) return null;
  return b;
}
