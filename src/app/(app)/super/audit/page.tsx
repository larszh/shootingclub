import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { AuditFilterForm, AuditList } from "../../admin/audit/audit-view";
import { auditActionPrefixes, listAudit, tenantNames } from "../../admin/audit/queries";
import { pageParam, textParam } from "../../admin/audit/pager";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.super.a.meta") };
}

export default async function SuperAuditPage({ searchParams }: { searchParams: Promise<{ action?: string; actor?: string; page?: string; tenant?: string }> }) {
  await requireSuperAdmin();
  const t = getT(await getRequestLocale());
  const sp = await searchParams;
  const action = textParam(sp.action, 60);
  const actor = textParam(sp.actor, 100);
  const tenant = textParam(sp.tenant, 191);
  const page = pageParam(sp.page);
  const tenantId = tenant === "platform" ? null : tenant || undefined;
  const [{ total, rows }, actions] = await Promise.all([listAudit({ tenantId, action, actor }, page), auditActionPrefixes()]);
  const names = await tenantNames(rows.map((r) => r.tenantId).concat(tenantId ? [tenantId] : []));
  const params = { action: action || undefined, actor: actor || undefined, tenant: tenant || undefined };
  const exportQs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
  const scope = tenant === "platform" ? t("adm2.super.a.platform") : tenantId ? names.get(tenantId) ?? (await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }))?.name ?? t("adm2.super.a.deletedClub") : t("adm2.super.a.allClubs");

  return (
    <div>
      <PageHeader title={t("adm2.super.a.title")} subtitle={scope} back={{ href: "/super", label: t("adm2.super.back") }} />
      {tenant ? <p className="mb-2 text-sm"><a href="/super/audit" className="text-accent inline-flex min-h-11 items-center">{t("adm2.super.a.showAll")}</a></p> : null}
      <AuditFilterForm base="/super/audit" actions={actions} action={action} actor={actor} />
      <AuditList rows={rows} total={total} page={page} base="/super/audit" params={params} tenantNames={names} exportHref={`/super/audit/export${exportQs ? `?${exportQs}` : ""}`} />
    </div>
  );
}
