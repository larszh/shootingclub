import type { Metadata } from "next";
import { BookOpenCheck, Download, Info } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { todayZurich } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { plural } from "@/lib/utils";
import { Alert, Button, Card, EmptyState, Field, Input, LinkButton, LinkTabs, PageHeader, SectionTitle, Select, StatCard } from "@/components/ui";
import { getAccountingJournal } from "@/modules/accounting/queries";
import { ENTRY_TYPE_LABEL, KIND_LABEL, type AccountSummary } from "@/modules/accounting/journal";
import { formatDateCh, MONTH_NAMES, resolvePeriod, type PeriodKind, type PeriodParams } from "@/modules/accounting/period";
import { EXPORT_FORMATS } from "@/modules/accounting/types";
import { AccountingSettingsForm } from "@/modules/accounting/ui/settings-form";

export const metadata: Metadata = { title: "Buchhaltung" };

const PREVIEW_LIMIT = 200;

const PERIOD_TABS: Array<{ value: PeriodKind; label: string }> = [
  { value: "year", label: "Jahr" },
  { value: "quarter", label: "Quartal" },
  { value: "month", label: "Monat" },
  { value: "custom", label: "Frei" },
];

function periodHref(kind: PeriodKind, year: number, extra: Record<string, string> = {}) {
  const p = new URLSearchParams({ period: kind, year: String(year), ...extra });
  return `/admin/accounting?${p.toString()}`;
}

function balanceText(s: AccountSummary) {
  if (s.balanceCents === 0) return { text: formatMoney(0, s.currency), side: "ausgeglichen" };
  return s.balanceCents > 0
    ? { text: formatMoney(s.balanceCents, s.currency), side: "Sollsaldo" }
    : { text: formatMoney(-s.balanceCents, s.currency), side: "Habensaldo" };
}

export default async function AccountingPage({ searchParams }: { searchParams: Promise<PeriodParams> }) {
  const ctx = await requirePermission("accounting.export");
  const sp = await searchParams;
  const today = todayZurich();
  const period = resolvePeriod(sp, today);
  const { accounts, entries, summary, totals } = await getAccountingJournal(ctx.tenant.id, period.from, period.to);

  const currentYear = Number(today.slice(0, 4));
  const years = Array.from({ length: 7 }, (_, i) => currentYear + 1 - i);
  const exportQuery = (format: string) => `/api/export/accounting?${new URLSearchParams({ format, from: period.from, to: period.to }).toString()}`;
  const preview = entries.slice(0, PREVIEW_LIMIT);
  const invalidCustom = period.kind === "custom" && (sp.from || sp.to) && (period.from !== sp.from || period.to !== sp.to);
  const periodEnded = period.to < today;

  return (
    <div>
      <PageHeader title="Buchhaltung" subtitle="Buchungen für Banana, bexio oder Excel exportieren" back={{ href: "/admin", label: "Einstellungen" }} />

      <SectionTitle>Periode</SectionTitle>
      <LinkTabs
        label="Periode wählen"
        active={period.kind}
        items={PERIOD_TABS.map((t) => ({
          value: t.value,
          label: t.label,
          href: t.value === "custom" ? periodHref("custom", period.year, { from: period.from, to: period.to }) : periodHref(t.value, period.year, t.value === "quarter" ? { q: String(period.quarter) } : t.value === "month" ? { m: String(period.month) } : {}),
        }))}
      />
      <Card className="animate-rise mt-3 p-4">
        <form method="get" action="/admin/accounting" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="period" value={period.kind} />
          {period.kind !== "custom" ? (
            <Field label="Jahr" className="w-28">
              <Select name="year" defaultValue={String(period.year)}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </Field>
          ) : null}
          {period.kind === "quarter" ? (
            <Field label="Quartal" className="w-36">
              <Select name="q" defaultValue={String(period.quarter)}>
                {[1, 2, 3, 4].map((q) => <option key={q} value={q}>{q}. Quartal</option>)}
              </Select>
            </Field>
          ) : null}
          {period.kind === "month" ? (
            <Field label="Monat" className="w-40">
              <Select name="m" defaultValue={String(period.month)}>
                {MONTH_NAMES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
              </Select>
            </Field>
          ) : null}
          {period.kind === "custom" ? (
            <>
              <Field label="Von" className="min-w-40 flex-1"><Input type="date" name="from" defaultValue={period.from} required /></Field>
              <Field label="Bis" className="min-w-40 flex-1"><Input type="date" name="to" defaultValue={period.to} required /></Field>
            </>
          ) : null}
          <Button type="submit" variant="secondary">Anzeigen</Button>
        </form>
        <p className="mt-3 text-sm text-ink-2">
          <span className="font-medium text-ink">{period.label}</span> · {formatDateCh(period.from)} bis {formatDateCh(period.to)}
        </p>
        {invalidCustom ? <Alert tone="warn" className="mt-3">Der gewählte Zeitraum war ungültig (Bis vor Von oder länger als drei Jahre). Angezeigt wird der Standardzeitraum.</Alert> : null}
      </Card>

      <div className="stagger mt-3 grid grid-cols-2 gap-2.5">
        <StatCard label="Buchungen" value={entries.length} hint={period.label} />
        <StatCard
          label="Kontrollsumme"
          value={<span className="block text-xl break-words">{totals.length ? totals.map((t) => formatMoney(t.cents, t.currency)).join(" · ") : formatMoney(0)}</span>}
          hint="Summe aller Buchungsbeträge"
        />
      </div>

      <SectionTitle>Export</SectionTitle>
      {!periodEnded ? (
        <Alert tone="info" className="mb-2.5" icon={<Info className="h-4 w-4" />}>
          Die Periode ist noch nicht abgeschlossen. Exportiert am besten erst nach Periodenende, damit später erfasste Zahlungen nicht fehlen.
        </Alert>
      ) : null}
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {EXPORT_FORMATS.map((f) => (
          <div key={f.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{f.label}</div>
              <p className="mt-0.5 text-xs text-ink-3">{f.hint}</p>
            </div>
            <LinkButton href={exportQuery(f.key)} variant="secondary" prefetch={false} className="shrink-0">
              <Download className="h-4 w-4" aria-hidden /> .{f.extension}
            </LinkButton>
          </div>
        ))}
      </Card>
      <p className="mt-2 text-xs text-ink-3">
        Das Journal zeigt den aktuellen Stand der Rechnungen. Wird eine Zahlung nachträglich zurückgesetzt oder storniert, ändert sich auch eine bereits exportierte Periode. Jeder Export wird im Protokoll festgehalten.
      </p>

      {entries.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<BookOpenCheck className="h-5 w-5" />}
          title="Keine Buchungen in dieser Periode"
          text="Buchungen entstehen aus Beitrags-, Reservations- und Munitionsrechnungen sowie Online-Zahlungen. Wählt eine andere Periode."
        />
      ) : (
        <>
          <SectionTitle>Saldo pro Konto</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {summary.map((s) => {
              const b = balanceText(s);
              return (
                <div key={`${s.account}-${s.currency}`} className="flex min-h-14 items-center gap-3 px-4 py-3">
                  <span className="w-14 shrink-0 font-mono text-sm font-semibold">{s.account}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.names.length ? s.names.join(" / ") : "Konto nicht im Kontenplan"}</div>
                    <div className="text-xs text-ink-3 tabular-nums">Soll {formatMoney(s.debitCents, s.currency)} · Haben {formatMoney(s.creditCents, s.currency)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">{b.text}</div>
                    <div className="text-xs text-ink-3">{b.side}</div>
                  </div>
                </div>
              );
            })}
          </Card>

          <SectionTitle>Journal</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            <div className="hidden grid-cols-[88px_110px_1fr_60px_60px_110px] gap-3 bg-surface-2 px-4 py-2 text-xs font-semibold text-ink-3 md:grid">
              <span>Datum</span><span>Beleg</span><span>Text</span><span>Soll</span><span>Haben</span><span className="text-right">Betrag</span>
            </div>
            {preview.map((e, i) => (
              <div key={`${e.docId}-${e.type}-${i}`} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-4 py-3 text-sm md:grid-cols-[88px_110px_1fr_60px_60px_110px] md:items-center">
                <span className="text-xs text-ink-3 tabular-nums md:text-sm md:text-ink-2">{formatDateCh(e.date)} <span className="md:hidden">· {e.doc}</span></span>
                <span className="text-right font-semibold tabular-nums md:order-last">{formatMoney(e.amountCents, e.currency)}</span>
                <span className="hidden truncate font-mono text-xs md:block">{e.doc}</span>
                <span className="col-span-2 min-w-0 md:col-span-1">
                  <span className="block truncate">{e.text}</span>
                  <span className="text-xs text-ink-3">{KIND_LABEL[e.kind]} · {ENTRY_TYPE_LABEL[e.type]}</span>
                </span>
                <span className="col-span-2 font-mono text-xs text-ink-2 md:col-span-1 md:text-sm">
                  <span className="md:hidden">Soll </span>{e.debit}
                  <span className="md:hidden"> / Haben {e.credit}</span>
                </span>
                <span className="hidden font-mono text-sm text-ink-2 md:block">{e.credit}</span>
              </div>
            ))}
          </Card>
          {entries.length > PREVIEW_LIMIT ? (
            <p className="mt-2 text-xs text-ink-3">Vorschau mit den ersten {PREVIEW_LIMIT} von {plural(entries.length, "Buchung", "Buchungen")}. Der Export enthält alle.</p>
          ) : null}
        </>
      )}

      <SectionTitle>Kontenplan</SectionTitle>
      <AccountingSettingsForm accounts={accounts} />
      <Card className="animate-rise mt-2.5 space-y-2 p-4 text-sm">
        <div className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4 text-ink-2" aria-hidden /> So wird gebucht</div>
        <ul className="list-disc space-y-1 pl-5 text-ink-2">
          <li>Rechnung ausgestellt: Soll Debitoren ({accounts.receivableAccount}) / Haben Ertrag (Beiträge {accounts.feeAccount}, Ersatzabgabe {accounts.workFeeAccount}, Reservationen {accounts.bookingAccount}, Munition {accounts.ammoAccount}).</li>
          <li>Rechnung bezahlt (auch online): Soll Bank ({accounts.bankAccount}) / Haben Debitoren am Zahlungsdatum.</li>
          <li>Rechnung storniert: Gegenbuchung Soll Ertrag / Haben Debitoren.</li>
          <li>Doppelt bezahlt (Bank und online): beide Zahlungen werden gebucht, das Guthaben steht auf Debitoren, bis ihr es zurückzahlt.</li>
          <li>Rückerstattung (Reservation als «Erstattet» markiert): Soll Ertrag / Haben Bank am Tag der Markierung; bei stornierter Rechnung Soll Debitoren / Haben Bank.</li>
          <li>Reservation direkt online bezahlt (ohne Rechnung): Soll Bank / Haben Reservationen.</li>
          <li>Rechnungen der Schützenstube gehen auf das Beitragskonto ({accounts.feeAccount}). Munition ist nie online bezahlbar, nur per Rechnung.</li>
        </ul>
      </Card>
    </div>
  );
}
