/** Protokoll der KI-Einstellungen (Aktionen «ai.*»). */
import { History } from "lucide-react";
import { Card } from "@/components/ui";
import { formatDateTime } from "@/lib/i18n/core";
import { aiT } from "../i18n";

export type AiAuditItem = { id: string; action: string; actorName: string | null; detail: string | null; createdAt: Date };

export function AiAuditList({ items, locale }: { items: AiAuditItem[]; locale: string }) {
  const t = aiT(locale);
  if (!items.length) return <Card className="animate-rise p-4 text-sm text-ink-3">{t("aiSet.audit.empty")}</Card>;
  return (
    <Card className="animate-rise divide-y divide-line overflow-hidden">
      {items.map((a) => {
        const key = `aiSet.audit.${a.action}`;
        const label = t(key);
        return (
          <div key={a.id} className="flex items-start gap-3 px-4 py-3">
            <History className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{label === key ? a.action : label}</p>
              <p className="break-words text-xs text-ink-3">
                {formatDateTime(a.createdAt, locale)}
                {a.actorName ? ` · ${a.actorName}` : ""}
                {a.detail ? ` · ${a.detail}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
