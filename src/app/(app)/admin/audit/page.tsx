import type { Metadata } from "next";
import { Archive } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui";
import { AuditFilterForm, AuditList } from "./audit-view";
import { auditActionPrefixes, listAudit } from "./queries";
import { pageParam, textParam } from "./pager";

export const metadata: Metadata = { title: "Protokoll" };

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ action?: string; actor?: string; page?: string }> }) {
  const ctx = await requirePermission("audit.view");
  const sp = await searchParams;
  const action = textParam(sp.action, 60);
  const actor = textParam(sp.actor, 100);
  const page = pageParam(sp.page);
  const tenantId = ctx.tenant.id;
  const [{ total, rows }, actions] = await Promise.all([listAudit({ tenantId, action, actor }, page), auditActionPrefixes(tenantId)]);
  const canArchive = ctx.tenant.role === "OWNER" || ctx.user.isSuperAdmin;
  const params = { action: action || undefined, actor: actor || undefined };
  const exportQs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();

  return (
    <div>
      <PageHeader
        title="Protokoll"
        subtitle="Wer hat wann was im Verein geändert"
        back={{ href: "/admin", label: "Verwaltung" }}
        action={canArchive ? (
          <a href="/api/export/archive" download className={cn(buttonClasses("secondary", "sm"), "min-h-11")}><Archive className="h-4 w-4" /> <span className="hidden sm:inline">Vereinsarchiv herunterladen</span><span className="sm:hidden">Archiv</span></a>
        ) : undefined}
      />
      <AuditFilterForm base="/admin/audit" actions={actions} action={action} actor={actor} />
      <AuditList rows={rows} total={total} page={page} base="/admin/audit" params={params} exportHref={`/admin/audit/export${exportQs ? `?${exportQs}` : ""}`} />
      {canArchive ? (
        <p className="mt-4 text-xs text-ink-3">Das Vereinsarchiv enthält Mitglieder, Resultate, Anlässe, Reservationen, Rechnungen und die Liste der Dateien als CSV in einer ZIP-Datei. Bitte sicher aufbewahren.</p>
      ) : null}
    </div>
  );
}
