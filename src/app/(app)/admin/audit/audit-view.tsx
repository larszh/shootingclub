import Link from "next/link";
import { Download, ScrollText } from "lucide-react";
import type { AuditLog } from "@/generated/prisma/client";
import { Badge, Card, EmptyState, buttonClasses, inputClass } from "@/components/ui";
import { formatDateTimeZurich } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Pager } from "./pager";
import { AUDIT_PAGE_SIZE } from "./queries";

function actionTone(action: string): "danger" | "warn" | "ok" | "neutral" {
  if (/(delete|purge|remove|revoke|fail)/.test(action)) return "danger";
  if (/(role|superadmin|password|2fa|totp|settings|import|export)/.test(action)) return "warn";
  if (/(create|restore|accept|grant)/.test(action)) return "ok";
  return "neutral";
}

export function AuditFilterForm({ base, actions, action, actor }: { base: string; actions: string[]; action: string; actor: string }) {
  return (
    <form action={base} method="get" className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr_auto]">
      <select name="action" defaultValue={action} aria-label="Bereich" className={inputClass}>
        <option value="">Alle Bereiche</option>
        {actions.map((a) => <option key={a} value={a}>{a.replace(/\.$/, "")}</option>)}
        {action && !actions.includes(action) ? <option value={action}>{action}</option> : null}
      </select>
      <input name="actor" defaultValue={actor} placeholder="Person (Name)" aria-label="Person" className={inputClass} maxLength={100} type="search" />
      <button type="submit" className={buttonClasses("secondary", "md")}>Filtern</button>
    </form>
  );
}

export function AuditList({ rows, total, page, base, params, tenantNames, exportHref }: {
  rows: AuditLog[];
  total: number;
  page: number;
  base: string;
  params: Record<string, string | undefined>;
  tenantNames?: Map<string, string>;
  exportHref: string;
}) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm text-ink-3 tabular-nums">{total} {total === 1 ? "Eintrag" : "Einträge"}</p>
        <a href={exportHref} className={cn(buttonClasses("ghost", "sm"), "min-h-11")} download><Download className="h-4 w-4" /> CSV</a>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-6 w-6" />} title="Keine Einträge" text="Sobald jemand Rollen ändert, löscht, importiert oder Einstellungen anpasst, erscheint es hier." />
      ) : (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {rows.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={actionTone(r.action)}>{r.action}</Badge>
                {tenantNames ? (
                  r.tenantId ? (
                    <Link href={`/super/audit?tenant=${encodeURIComponent(r.tenantId)}`} className="text-xs text-accent truncate max-w-[50%]">{tenantNames.get(r.tenantId) ?? "Gelöschter Verein"}</Link>
                  ) : <span className="text-xs text-ink-3">Plattform</span>
                ) : null}
                <span className="ml-auto text-xs text-ink-3 tabular-nums">{formatDateTimeZurich(r.createdAt)}</span>
              </div>
              {r.detail ? <p className="mt-1 text-sm text-ink break-words">{r.detail}</p> : null}
              <p className="mt-0.5 text-xs text-ink-3 break-words">
                {r.actorName ?? (r.actorId ? "Unbekannt" : "System")}
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

/** Spaltenweise Daten für den CSV-Export. */
export function auditCsvRows(rows: AuditLog[], tenantNames?: Map<string, string>) {
  const head = ["Zeitpunkt (UTC)", ...(tenantNames ? ["Verein"] : []), "Aktion", "Person", "Personen-ID", "Objekt", "Objekt-ID", "Details", "IP"];
  return [
    head,
    ...rows.map((r) => [
      r.createdAt.toISOString(),
      ...(tenantNames ? [r.tenantId ? tenantNames.get(r.tenantId) ?? r.tenantId : "Plattform"] : []),
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
