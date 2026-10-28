import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Download, FileUp, Wallet } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { Alert, Card, EmptyState, LinkButton, LinkTabs, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { anyPaymentModule, listOpenItems, PAYMENT_SOURCE_LABEL, type PaymentSource } from "@/modules/billing/overview";
import { nowDate } from "@/modules/billing/dates";
import { PaymentRow, SourceIcon, formatTotals } from "@/modules/billing/ui/payment-rows";
import { cn, plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Offene Posten" };

const SOURCE_ADMIN: Record<PaymentSource, { href: string; label: string }> = {
  FEE: { href: "/admin/billing", label: "Beiträge verwalten" },
  BOOKING: { href: "/admin/bookings", label: "Reservationen verwalten" },
  ONLINE: { href: "/admin/bookings/payments", label: "Zahlungen" },
  AMMO: { href: "/admin/ammo", label: "Munition verwalten" },
};

const SOURCE_PARAM = ["all", "FEE", "BOOKING", "AMMO"] as const;
type SourceParam = (typeof SOURCE_PARAM)[number];

function query(source: SourceParam, overdue: boolean) {
  const p = new URLSearchParams();
  if (source !== "all") p.set("source", source);
  if (overdue) p.set("overdue", "1");
  const s = p.toString();
  return s ? `?${s}` : "";
}

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ source?: string; overdue?: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  const sp = await searchParams;

  if (!anyPaymentModule(ctx)) {
    return (
      <div>
        <PageHeader title="Offene Posten" subtitle={ctx.tenant.name} back={{ href: "/admin", label: "Einstellungen" }} />
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="Keine Rechnungsmodule aktiv"
          text="Schalte Mitgliederbeiträge, Reservationen oder Munition ein, dann erscheinen die offenen Rechnungen hier."
          action={<LinkButton href="/admin" variant="secondary" size="sm">Module ansehen</LinkButton>}
        />
      </div>
    );
  }

  const data = await listOpenItems(ctx, nowDate());
  const source: SourceParam = SOURCE_PARAM.includes(sp.source as SourceParam) && data.bySource.some((b) => b.source === sp.source) ? (sp.source as SourceParam) : "all";
  const overdueOnly = sp.overdue === "1";
  const visible = data.items.filter((i) => (source === "all" || i.source === source) && (!overdueOnly || i.overdue));
  const importAvailable = ctx.hasModule("billing") || ctx.hasModule("bookings") || ctx.hasModule("ammo");

  return (
    <div>
      <PageHeader
        title="Offene Posten"
        subtitle={`Alle unbezahlten Rechnungen von ${ctx.tenant.name}`}
        back={{ href: "/admin", label: "Einstellungen" }}
        action={
          <LinkButton href={`/admin/payments/export${query(source, overdueOnly)}`} variant="secondary" size="sm" prefetch={false}>
            <Download className="h-4 w-4" /> CSV
          </LinkButton>
        }
      />

      <div className="stagger grid grid-cols-2 gap-2.5">
        <StatCard
          label="Total offen"
          value={<span className="block text-xl break-words">{formatTotals(data.totals)}</span>}
          hint={plural(data.items.length, "Rechnung", "Rechnungen")}
          tone={data.items.length ? "accent" : "neutral"}
          href={`/admin/payments${query("all", false)}`}
        />
        <StatCard
          label="Davon überfällig"
          value={<span className="block text-xl break-words">{formatTotals(data.overdueTotals)}</span>}
          hint={plural(data.overdueCount, "Rechnung", "Rechnungen")}
          tone={data.overdueCount ? "warn" : "neutral"}
          href={`/admin/payments${query(source, true)}`}
        />
      </div>

      <SectionTitle>Nach Bereich</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {data.bySource.map((b) => (
          <div key={b.source} className="flex min-h-14 items-center gap-3 px-4 py-3">
            <SourceIcon source={b.source} tone={b.overdue ? "danger" : "neutral"} />
            <div className="min-w-0 flex-1">
              <Link href={`/admin/payments${query(b.source as SourceParam, overdueOnly)}`} className="font-medium hover:underline">
                {PAYMENT_SOURCE_LABEL[b.source]}
              </Link>
              <div className="text-xs text-ink-3">
                {plural(b.count, "offene Rechnung", "offene Rechnungen")}
                {b.overdue ? <span className="font-medium text-danger"> · {b.overdue} überfällig</span> : null}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold tabular-nums">{formatTotals(b.totals)}</div>
              <Link href={SOURCE_ADMIN[b.source].href} className="inline-flex min-h-11 items-center gap-0.5 text-xs text-ink-3 hover:text-ink">
                {SOURCE_ADMIN[b.source].label} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        ))}
      </Card>

      {importAvailable ? (
        <Link href="/admin/billing/import" className="press mt-2.5 block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <Card className="flex items-center gap-3 p-4 transition-colors hover:border-ink/30">
            <FileUp className="h-5 w-5 text-ink-2" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="font-medium">Bankauszug importieren</div>
              <div className="text-xs text-ink-3">camt.053/054 hochladen, Zahlungen werden automatisch zugeordnet.</div>
            </div>
            <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
          </Card>
        </Link>
      ) : null}

      <SectionTitle>Rechnungen</SectionTitle>
      <LinkTabs
        label="Nach Bereich filtern"
        active={source}
        items={[
          { value: "all", href: `/admin/payments${query("all", overdueOnly)}`, label: "Alle", count: data.items.filter((i) => !overdueOnly || i.overdue).length },
          ...data.bySource.map((b) => ({
            value: b.source,
            href: `/admin/payments${query(b.source as SourceParam, overdueOnly)}`,
            label: PAYMENT_SOURCE_LABEL[b.source],
            count: overdueOnly ? b.overdue : b.count,
          })),
        ]}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/payments${query(source, !overdueOnly)}`}
          aria-pressed={overdueOnly}
          className={cn(
            "press inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium",
            overdueOnly ? "border-danger bg-danger text-white" : "border-line bg-surface text-ink-2 hover:bg-surface-2",
          )}
        >
          <AlertTriangle className="h-4 w-4" aria-hidden /> Nur überfällige
        </Link>
      </div>

      {data.overdueCount > 0 && !overdueOnly ? (
        <div className="mt-3">
          <Alert tone="warn">
            {plural(data.overdueCount, "Rechnung ist", "Rechnungen sind")} überfällig. Mahnungen für Beiträge versendest du unter{" "}
            <Link href="/admin/billing" className="font-semibold underline underline-offset-2">Mitgliederbeiträge</Link>.
          </Alert>
        </div>
      ) : null}

      {visible.length ? (
        <Card className="animate-rise mt-3 divide-y divide-line overflow-hidden">
          {visible.map((i) => (
            <PaymentRow key={i.key} item={i} showMember />
          ))}
        </Card>
      ) : (
        <EmptyState
          className="mt-3"
          icon={<Wallet className="h-5 w-5" />}
          title={overdueOnly ? "Nichts überfällig" : "Keine offenen Rechnungen"}
          text={overdueOnly ? "Alle offenen Rechnungen sind noch innerhalb der Zahlungsfrist." : "Alle Rechnungen in diesem Bereich sind bezahlt."}
        />
      )}
    </div>
  );
}
