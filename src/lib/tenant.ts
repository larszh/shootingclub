import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { MODULES, type ModuleKey } from "@/lib/modules";
import { can, type Permission } from "@/lib/permissions";

const TENANT_COOKIE = "standchef_tenant";

export async function setActiveTenantCookie(tenantId: string) {
  const jar = await cookies();
  jar.set(TENANT_COOKIE, tenantId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export type ActiveTenant = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  role: string | null; // null = Super-Admin ohne Mitgliedschaft
  enabledModules: ModuleKey[];
  logoUrl: string | null;
  brandColor: string | null;
  brandColor2: string | null;
};

export type AppContext = {
  user: CurrentUser;
  tenant: ActiveTenant | null;
  can: (perm: Permission) => boolean;
  hasModule: (key: ModuleKey) => boolean;
};

/** Benutzer + aktiver Tenant. Leitet auf /login um, wenn nicht angemeldet. */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const jar = await cookies();
  const wanted = jar.get(TENANT_COOKIE)?.value;

  let tenant: ActiveTenant | null = null;
  // Reihenfolge: gewünschter Tenant mit Mitgliedschaft → gewünschter Tenant als Super-Admin
  // (ohne Mitgliedschaft) → erste Mitgliedschaft als Rückfall.
  const wantedMembership = wanted ? user.memberships.find((m) => m.tenantId === wanted) : undefined;

  const toActive = (t: { id: string; slug: string; name: string; kind: string; logoPath: string | null; brandColor: string | null; brandColor2: string | null; updatedAt: Date }, role: string | null): ActiveTenant => ({
    id: t.id, slug: t.slug, name: t.name, kind: t.kind, role, enabledModules: [],
    logoUrl: t.logoPath ? `/api/avatars/tenant/${t.id}?v=${t.updatedAt.getTime()}` : null,
    brandColor: t.brandColor, brandColor2: t.brandColor2,
  });
  if (wantedMembership) {
    tenant = toActive(wantedMembership.tenant, wantedMembership.role);
  } else if (user.isSuperAdmin && wanted) {
    const t = await db.tenant.findUnique({ where: { id: wanted }, select: { id: true, slug: true, name: true, kind: true, logoPath: true, brandColor: true, brandColor2: true, updatedAt: true } });
    if (t) tenant = toActive(t, null);
  }
  if (!tenant && user.memberships[0]) {
    const fallback = user.memberships[0];
    tenant = toActive(fallback.tenant, fallback.role);
  }

  if (tenant) {
    const mods = await db.tenantModule.findMany({ where: { tenantId: tenant.id } });
    const enabled = new Set<string>();
    for (const m of MODULES) if (m.defaultEnabled) enabled.add(m.key);
    for (const m of mods) {
      if (m.enabled) enabled.add(m.moduleKey);
      else enabled.delete(m.moduleKey);
    }
    tenant.enabledModules = [...enabled] as ModuleKey[];
  }

  const actor = { isSuperAdmin: user.isSuperAdmin, role: tenant?.role ?? null };
  return {
    user,
    tenant,
    can: (perm) => (tenant ? can(actor, perm) : user.isSuperAdmin),
    hasModule: (key) => tenant?.enabledModules.includes(key) ?? false,
  };
});

/** Wie getAppContext, verlangt aber einen aktiven Tenant. */
export async function requireTenant(): Promise<AppContext & { tenant: ActiveTenant }> {
  const ctx = await getAppContext();
  if (!ctx.tenant) redirect("/onboarding");
  return ctx as AppContext & { tenant: ActiveTenant };
}

export async function requireModule(key: ModuleKey) {
  const ctx = await requireTenant();
  if (!ctx.hasModule(key)) redirect("/?module=" + key);
  return ctx;
}

export async function requirePermission(perm: Permission) {
  const ctx = await requireTenant();
  if (!ctx.can(perm)) redirect("/?denied=1");
  return ctx;
}

export async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isSuperAdmin) redirect("/?denied=1");
  return user;
}
