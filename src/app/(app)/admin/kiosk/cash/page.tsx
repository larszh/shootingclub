import type { Metadata } from "next";
import { Banknote } from "lucide-react";
import { Card, EmptyState, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { requireKioskAdmin } from "@/modules/kiosk/guard";
import { cashSummary } from "@/modules/kiosk/queries";
import { getBillingProfile } from "@/modules/billing/profile";

export const metadata: Metadata = { title: "Schützenstube: Kasse" };

const dayLabel = (day: string) => new Intl.DateTimeFormat("de-CH", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${day}T12:00:00Z`));

/** Tagesabschluss: Barverkäufe der letzten 14 Tage pro Tag und Produkt. */
export default async function KioskCashPage() {
  const ctx = await requireKioskAdmin();
  const [{ today, days }, profile] = await Promise.all([cashSummary(ctx.tenant.id, 14), getBillingProfile(ctx.tenant.id, ctx.tenant.name)]);
  const cur = profile.currency;
  const todayRow = days.find((d) => d.day === today);
  const sum14 = days.reduce((s, d) => s + d.totalCents, 0);

  return (
    <div>
      <PageHeader title="Kasse" subtitle="Barverkäufe pro Tag (Tagesabschluss)" back={{ href: "/admin/kiosk", label: "Schützenstube" }} />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard label="Heute bar" value={formatMoney(todayRow?.totalCents ?? 0, cur)} hint={`${todayRow?.count ?? 0} ${todayRow?.count === 1 ? "Eintrag" : "Einträge"}`} tone={todayRow ? "accent" : "neutral"} />
        <StatCard label="Letzte 14 Tage" value={formatMoney(sum14, cur)} hint={`${days.length} Tage mit Barverkauf`} />
      </div>
      {days.length ? days.map((d) => (
        <section key={d.day}>
          <SectionTitle>{d.day === today ? `Heute, ${dayLabel(d.day)}` : dayLabel(d.day)}</SectionTitle>
          <Card className="animate-rise mb-2 divide-y divide-line overflow-hidden">
            {d.products.map((p) => (
              <div key={p.name} className="flex min-h-11 items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1 truncate"><span className="tabular-nums">{p.quantity} ×</span> {p.name}</span>
                <span className="shrink-0 tabular-nums">{formatMoney(p.totalCents, cur)}</span>
              </div>
            ))}
            <div className="flex min-h-12 items-center justify-between bg-surface-2 px-4 py-2 font-semibold">
              <span>Total bar ({d.count} {d.count === 1 ? "Eintrag" : "Einträge"})</span>
              <span className="tabular-nums">{formatMoney(d.totalCents, cur)}</span>
            </div>
          </Card>
        </section>
      )) : <EmptyState icon={<Banknote className="h-5 w-5" />} title="Keine Barverkäufe" text="In den letzten 14 Tagen wurde nichts bar erfasst." />}
      <p className="mt-3 text-xs text-ink-3">Der Betrag sollte dem Bargeld in der Kasse entsprechen (abzüglich Wechselgeld). Einzelne Einträge: unter «Einträge» mit Filter «Bar».</p>
    </div>
  );
}
