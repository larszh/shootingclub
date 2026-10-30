import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireRangeAdmin } from "@/modules/range/guard";
import { listAllResources, listQuotas, listWindows } from "@/modules/range/queries";
import { deleteQuotaAction, deleteWindowAction } from "@/modules/range/actions";
import { formatMinutes, WEEKDAY_ORDER, WEEKDAYS } from "@/modules/range/logic";
import { CHECK_HINT } from "@/modules/range/types";
import { ADMIN_RANGE_TABS } from "@/modules/range/nav";
import { RangeTabs } from "@/modules/range/ui/range-tabs";
import { QuotaForm, WindowForm } from "@/modules/range/ui/times-forms";

export const metadata: Metadata = { title: "Schiesszeiten" };

export default async function AdminRangeTimesPage() {
  const ctx = await requireRangeAdmin();
  const year = Number(todayZurich().slice(0, 4));
  const [resources, windows, quotas] = await Promise.all([listAllResources(ctx.tenant.id), listWindows(ctx.tenant.id), listQuotas(ctx.tenant.id)]);
  const groups = new Map<string, { name: string; items: typeof windows }>();
  for (const w of windows) {
    const key = w.resourceId ?? "";
    const g = groups.get(key) ?? { name: w.resource?.name ?? "Ganze Anlage", items: [] };
    g.items.push(w);
    groups.set(key, g);
  }
  const bookingsOn = ctx.hasModule("bookings");

  return (
    <div className="space-y-4">
      <PageHeader title="Schiesszeiten" subtitle="Bewilligte Zeiten und Kontingent" back={{ href: "/admin", label: "Einstellungen" }} />
      <RangeTabs tabs={ADMIN_RANGE_TABS} label="Standbetrieb einrichten" />

      <SectionTitle>Wöchentliche Schiesszeiten</SectionTitle>
      {groups.size ? (
        [...groups.entries()].map(([key, g]) => (
          <Card key={key || "all"} className="overflow-hidden">
            <div className="border-b border-line bg-surface-2 px-4 py-2 text-sm font-semibold">{g.name}</div>
            <div className="divide-y divide-line">
              {WEEKDAY_ORDER.flatMap((d) => g.items.filter((w) => w.weekday === d)).map((w) => (
                <div key={w.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <span className="w-24 shrink-0 font-medium">{WEEKDAYS[w.weekday]}</span>
                  <span className="tabular-nums">{formatMinutes(w.startMinute)}–{formatMinutes(w.endMinute)}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-3">{w.note ?? ""}</span>
                  <ActionButton variant="ghost" size="sm" className="h-11 w-11 px-0" aria-label="Schiesszeit entfernen" action={deleteWindowAction.bind(null, w.id)} confirm={{ title: "Schiesszeit entfernen?", tone: "danger", confirmLabel: "Entfernen" }}>
                    <Trash2 className="h-4 w-4" />
                  </ActionButton>
                </div>
              ))}
            </div>
          </Card>
        ))
      ) : (
        <EmptyState title="Keine Schiesszeiten erfasst" text="Ohne Schiesszeiten gibt es keine Einschränkung bei Reservationen." />
      )}
      <WindowForm resources={resources.map((r) => ({ id: r.id, name: r.name }))} />
      {bookingsOn ? (
        <p className="text-xs text-ink-3">Reservationen: Gibt es Schiesszeiten für eine Anlage (oder die ganze Anlage), müssen Reservationen von Mitgliedern darin liegen. Die Verwaltung kann ausserhalb reservieren; die Reservation wird dann markiert.</p>
      ) : null}

      <SectionTitle>Kontingente</SectionTitle>
      {quotas.length ? (
        <Card className="divide-y divide-line overflow-hidden">
          {quotas.map((q) => (
            <div key={q.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <span className="w-14 shrink-0 font-semibold tabular-nums">{q.year}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{q.resource?.name ?? "Ganze Anlage"}: {q.maxHalfDays} Halbtage</div>
                {q.note ? <div className="truncate text-xs text-ink-3">{q.note}</div> : null}
              </div>
              <ActionButton variant="ghost" size="sm" className="h-11 w-11 px-0" aria-label="Kontingent entfernen" action={deleteQuotaAction.bind(null, q.id)} confirm={{ title: "Kontingent entfernen?", tone: "danger", confirmLabel: "Entfernen" }}>
                <Trash2 className="h-4 w-4" />
              </ActionButton>
            </div>
          ))}
        </Card>
      ) : null}
      <QuotaForm resources={resources.map((r) => ({ id: r.id, name: r.name }))} year={year} />
      <p className="text-xs text-ink-3">Schiesszeiten und Kontingente stammen aus der Bewilligung der Gemeinde bzw. des Kantons. {CHECK_HINT}</p>
    </div>
  );
}
