import "server-only";
import { db } from "@/lib/db";
import type { AppContext } from "@/lib/tenant";
import { parsePaperSizes, parseTargetParams, type PaperSize, type TargetParams } from "./types";

export type TargetView = {
  id: string;
  name: string;
  description: string | null;
  subject: string;
  params: TargetParams;
  paperSizes: PaperSize[];
  filePath: string | null;
  mimeType: string | null;
  scope: "global" | "tenant" | "mine";
  ownerUserId: string | null;
  sharedWithTenant: boolean;
  hidden: boolean;
  favorite: boolean;
  isArchived: boolean;
  createdAt: Date;
};

type Row = {
  id: string; name: string; description: string | null; subject: string; paramsJson: string; paperSizes: string;
  filePath: string | null; mimeType: string | null; tenantId: string | null; ownerUserId: string | null;
  sharedWithTenant: boolean; isArchived: boolean; createdAt: Date;
};

function toView(t: Row, userId: string, hidden: boolean, favorite: boolean): TargetView {
  let params: TargetParams = {};
  try {
    params = parseTargetParams(JSON.parse(t.paramsJson));
  } catch { /* leer */ }
  const scope: TargetView["scope"] = t.ownerUserId ? (t.ownerUserId === userId ? "mine" : "tenant") : t.tenantId ? "tenant" : "global";
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    subject: t.subject,
    params,
    paperSizes: parsePaperSizes(t.paperSizes),
    filePath: t.filePath,
    mimeType: t.mimeType,
    scope,
    ownerUserId: t.ownerUserId,
    sharedWithTenant: t.sharedWithTenant,
    hidden,
    favorite,
    isArchived: t.isArchived,
    createdAt: t.createdAt,
  };
}

/** Sichtbare Scheiben: global + Tenant + eigene Uploads + im Tenant geteilte Uploads. */
export async function listTargets(ctx: AppContext & { tenant: NonNullable<AppContext["tenant"]> }, opts?: { includeHidden?: boolean }) {
  const [targets, settings, favs] = await Promise.all([
    db.targetTemplate.findMany({
      where: {
        isArchived: false,
        OR: [
          { tenantId: null, ownerUserId: null },
          { tenantId: ctx.tenant.id, ownerUserId: null },
          { ownerUserId: ctx.user.id },
          { tenantId: ctx.tenant.id, sharedWithTenant: true },
        ],
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    db.targetTenantSetting.findMany({ where: { tenantId: ctx.tenant.id } }),
    db.targetFavorite.findMany({ where: { userId: ctx.user.id } }),
  ]);
  const hidden = new Set(settings.filter((s) => s.hidden).map((s) => s.targetId));
  const favSet = new Set(favs.map((f) => f.targetId));
  const views = targets.map((t) => toView(t, ctx.user.id, hidden.has(t.id), favSet.has(t.id)));
  return opts?.includeHidden ? views : views.filter((v) => !v.hidden || v.scope === "mine");
}

export async function getTarget(ctx: AppContext & { tenant: NonNullable<AppContext["tenant"]> }, id: string) {
  const t = await db.targetTemplate.findUnique({ where: { id } });
  if (!t) return null;
  const visible =
    (t.tenantId === null && t.ownerUserId === null) ||
    (t.tenantId === ctx.tenant.id && (t.ownerUserId === null || t.sharedWithTenant)) ||
    t.ownerUserId === ctx.user.id ||
    ctx.user.isSuperAdmin;
  if (!visible) return null;
  const [setting, fav] = await Promise.all([
    db.targetTenantSetting.findUnique({ where: { targetId_tenantId: { targetId: id, tenantId: ctx.tenant.id } } }),
    db.targetFavorite.findUnique({ where: { userId_targetId: { userId: ctx.user.id, targetId: id } } }),
  ]);
  return toView(t, ctx.user.id, setting?.hidden ?? false, !!fav);
}

export async function listGlobalTargets(userId: string) {
  const ts = await db.targetTemplate.findMany({ where: { tenantId: null, ownerUserId: null }, orderBy: { name: "asc" } });
  return ts.map((t) => toView(t, userId, false, false));
}
