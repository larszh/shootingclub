import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Settings, Wallet } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { Card, EmptyState, LinkButton, LinkTabs, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { anyPaymentModule, listMyPayments } from "@/modules/billing/overview";
import { nowDate } from "@/modules/billing/dates";
import { OpenPaymentCard, PaymentRow, formatTotals } from "@/modules/billing/ui/payment-rows";
import { plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Zahlungen" };

const FILTERS = ["open", "paid", "all"] as const;
type Filter = (typeof FILTERS)[number];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const ctx = await requireTenant();
  const sp = await searchParams;
  const canManage = ctx.can("tenant.manage");

  if (!anyPaymentModule(ctx)) {
    return (
      <div>
        <PageHeader title="Zahlungen" subtitle={ctx.tenant.name} />
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="Keine Rechnungen in diesem Verein"
          text="Rechnungen erscheinen hier, sobald der Verein Mitgliederbeiträge, Reservationen oder Munition aktiviert hat."
        />
      </div>
    );
  }

  const data = await listMyPayments(ctx, nowDate());
  const requested = FILTERS.includes(sp.filter as Filter) ? (sp.filter as Filter) : null;
  const filter: Filter = requested ?? (data.openCount > 0 ? "open" : "all");
  const open = data.items.filter((i) => i.group === "open");
  const paid = data.items.filter((i) => i.group === "paid");
  const rest = filter === "all" ? data.items.filter((i) => i.group !== "open") : filter === "paid" ? paid : [];
  const payee = { iban: data.profile.iban, payeeName: data.profile.payeeName ?? ctx.tenant.name, qrIban: data.profile.qrIban };
  const showOpen = filter === "open" || filter === "all";

  return (
    <div>
      <PageHeader
        title="Zahlungen"
        subtitle={`Alle deine Rechnungen bei ${ctx.tenant.name}`}
        action={canManage ? <LinkButton href="/admin/payments" variant="secondary" size="sm"><Settings className="h-4 w-4" /> Offene Posten</LinkButton> : null}
      />

      <div className="stagger grid grid-cols-2 gap-2.5">
        <StatCard
          label="Offen"
          value={<span className="block text-xl break-words">{formatTotals(data.openTotals)}</span>}
          tone={data.overdueCount > 0 ? "warn" : data.openCount > 0 ? "accent" : "neutral"}
          hint={data.openCount ? `${plural(data.openCount, "Rechnung", "Rechnungen")}${data.overdueCount ? `, ${data.overdueCount} überfällig` : ""}` : "Alles bezahlt"}
          href="/payments?filter=open"
        />
        <StatCard label={`Bezahlt ${data.year}`} value={<span className="block text-xl break-words">{formatTotals(data.paidThisYear)}</span>} tone="ok" hint="seit 1. Januar" href="/payments?filter=paid" />
      </div>

      <LinkTabs
        className="mt-4"
        label="Zahlungen filtern"
        active={filter}
        items={[
          { value: "open", href: "/payments?filter=open", label: "Offen", count: open.length },
          { value: "paid", href: "/payments?filter=paid", label: "Bezahlt", count: paid.length },
          { value: "all", href: "/payments?filter=all", label: "Alle", count: data.items.length },
        ]}
      />

      {showOpen && open.length ? (
        <>
          <p className="mt-4 text-sm text-ink-2">
            {data.onlineFeeProvider && open.some((i) => i.payOnlineHref)
              ? `Beiträge und Vereinsrechnungen kannst du direkt online bezahlen (${data.onlineFeeMethods ?? "Karte"} über ${data.onlineFeeProvider}). Sonst: QR-Rechnung öffnen und mit der Banking-App scannen.`
              : "Am einfachsten: QR-Rechnung öffnen und mit der Banking- oder TWINT-App scannen. Oder IBAN und Referenz kopieren und im E-Banking einfügen."}
          </p>
          <div className="stagger mt-3 space-y-3">
            {open.map((i) =>
              // Online-Zahlung nur für Beitragsrechnungen (FeeInvoice), nie für Munition.
              i.payOnlineHref && i.source === "FEE" ? (
                <div key={i.key} className="space-y-2">
                  <OpenPaymentCard item={i} payee={payee} />
                  <LinkButton href={i.payOnlineHref} prefetch={false} className="w-full" aria-label={`${i.title} ${i.number} online bezahlen`}>
                    <CreditCard className="h-4 w-4" aria-hidden /> Online bezahlen
                  </LinkButton>
                </div>
              ) : (
                <OpenPaymentCard key={i.key} item={i} payee={payee} />
              ),
            )}
          </div>
        </>
      ) : null}

      {filter === "open" && !open.length ? (
        <EmptyState
          className="mt-4"
          icon={<Wallet className="h-5 w-5" />}
          title="Nichts offen"
          text="Du hast alle Rechnungen bezahlt. Danke!"
          action={<LinkButton href="/payments?filter=all" variant="secondary" size="sm">Alle anzeigen</LinkButton>}
        />
      ) : null}

      {rest.length ? (
        <>
          {filter === "all" && open.length ? <SectionTitle>Erledigt</SectionTitle> : <div className="mt-4" />}
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {rest.map((i) => (
              <PaymentRow key={i.key} item={i} />
            ))}
          </Card>
        </>
      ) : filter !== "open" && !(filter === "all" && open.length) ? (
        <EmptyState className="mt-4" icon={<Wallet className="h-5 w-5" />} title="Noch keine Zahlungen" text="Bezahlte Rechnungen und Online-Zahlungen erscheinen hier." />
      ) : null}

      {!ctx.user.street ? (
        <p className="mt-6 text-xs text-ink-3">
          Tipp: Hinterlege deine Adresse unter <Link href="/me" className="underline">Mehr → Profil</Link>, dann ist sie auf den Rechnungen und im QR-Code vorausgefüllt.
        </p>
      ) : null}
    </div>
  );
}
