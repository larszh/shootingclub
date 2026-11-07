import Link from "next/link";
import { Download, ScrollText } from "lucide-react";
import type { AuditLog } from "@/generated/prisma/client";
import { Badge, Card, EmptyState, buttonClasses, inputClass } from "@/components/ui";
import { formatDateTime, getRequestLocale, getT, type TFunction } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Pager } from "./pager";
import { AUDIT_PAGE_SIZE } from "./queries";

function actionTone(action: string): "danger" | "warn" | "ok" | "neutral" {
  if (/(delete|purge|remove|revoke|fail)/.test(action)) return "danger";
  if (/(role|superadmin|password|2fa|totp|settings|import|export)/.test(action)) return "warn";
  if (/(create|restore|accept|grant)/.test(action)) return "ok";
  return "neutral";
}

export async function AuditFilterForm({ base, actions, action, actor }: { base: string; actions: string[]; action: string; actor: string }) {
  const t = getT(await getRequestLocale());
  return (
    <form action={base} method="get" className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr_auto]">
      <select name="action" defaultValue={action} aria-label={t("adm1.audit.area")} className={inputClass}>
        <option value="">{t("adm1.audit.allAreas")}</option>
        {actions.map((a) => <option key={a} value={a}>{a.replace(/\.$/, "")}</option>)}
        {action && !actions.includes(action) ? <option value={action}>{action}</option> : null}
      </select>
      <input name="actor" defaultValue={actor} placeholder={t("adm1.audit.personPlaceholder")} aria-label={t("adm1.audit.person")} className={inputClass} maxLength={100} type="search" />
      <button type="submit" className={buttonClasses("secondary", "md")}>{t("adm1.common.filter")}</button>
    </form>
  );
}

export async function AuditList({ rows, total, page, base, params, tenantNames, exportHref }: {
  rows: AuditLog[];
  total: number;
  page: number;
  base: string;
  params: Record<string, string | undefined>;
  tenantNames?: Map<string, string>;
  exportHref: string;
}) {
  const locale = await getRequestLocale();
  const t = getT(locale);
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm text-ink-3 tabular-nums">{t(total === 1 ? "adm1.audit.entries.one" : "adm1.audit.entries.other", { n: total })}</p>
        <a href={exportHref} className={cn(buttonClasses("ghost", "sm"), "min-h-11")} download><Download className="h-4 w-4" /> CSV</a>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-6 w-6" />} title={t("adm1.audit.empty")} text={t("adm1.audit.emptyText")} />
      ) : (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {rows.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={actionTone(r.action)}>{r.action}</Badge>
                {tenantNames ? (
                  r.tenantId ? (
                    <Link href={`/super/audit?tenant=${encodeURIComponent(r.tenantId)}`} className="text-xs text-accent truncate max-w-[50%]">{tenantNames.get(r.tenantId) ?? t("adm1.audit.deletedClub")}</Link>
                  ) : <span className="text-xs text-ink-3">{t("adm1.audit.platform")}</span>
                ) : null}
                <span className="ml-auto text-xs text-ink-3 tabular-nums">{formatDateTime(r.createdAt, locale)}</span>
              </div>
              {r.detail ? <p className="mt-1 text-sm text-ink break-words">{r.detail}</p> : null}
              <p className="mt-0.5 text-xs text-ink-3 break-words">
                {r.actorName ?? (r.actorId ? t("adm1.audit.unknown") : t("adm1.audit.system"))}
                {r.entity ? ` · ${r.entity}` : ""}
                {r.ip ? ` · ${r.ip}` : ""}
              </p>
            </div>
          ))}
        </Card>
      )}
      <Pager base={base} page={page} pageSize={AUDIT_PAGE_SIZE} total={total} params={params} />
    </>
  );
}

/** Spaltenweise Daten für den CSV-Export (Spaltenköpfe in der Sprache von `t`, Standard Deutsch). */
export function auditCsvRows(rows: AuditLog[], tenantNames?: Map<string, string>, t: TFunction = getT("de")) {
  const head = ["time", ...(tenantNames ? ["club"] : []), "action", "person", "personId", "entity", "entityId", "details", "ip"].map((k) => t(`adm1.audit.csv.${k}`));
  return [
    head,
    ...rows.map((r) => [
      r.createdAt.toISOString(),
      ...(tenantNames ? [r.tenantId ? tenantNames.get(r.tenantId) ?? r.tenantId : t("adm1.audit.platform")] : []),
      r.action,
      r.actorName,
      r.actorId,
      r.entity,
      r.entityId,
      r.detail,
      r.ip,
    ]),
  ];
}
