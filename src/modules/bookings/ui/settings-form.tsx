"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Plus, Trash2, Users } from "lucide-react";
import { saveBookingSettingsAction } from "@/modules/bookings/actions";
import { PAYMENT_PROVIDERS, PERSONS_LIMIT, type DurationOption, type OpeningHours } from "@/modules/bookings/types";
import { formatShortMoney, priceTablePreview } from "@/modules/bookings/pricing";
import type { BookingSettingsView } from "@/modules/bookings/queries";
import { Alert, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { parseMoneyToCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/components/locale";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/core";

/** Zeile im Dauer-Editor; Beträge bleiben Text, bis der Server sie prüft. */
export type DurationRow = { minutes: number; price: string; personPrices?: string[]; flatFrom?: string; flatPrice?: string };

/** Wochentag (0 = Sonntag) in der Sprache der Seite; 2023-01-01 war ein Sonntag. */
function dayName(d: number, locale: Locale, weekday: "long" | "short") {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday, timeZone: "UTC" }).format(new Date(Date.UTC(2023, 0, 1 + d)));
}

function centsOrNull(v: string | undefined) {
  if (v === undefined || v.trim() === "") return null;
  return parseMoneyToCents(v.replace(/[.,][–-]+$/, ""));
}

/** Editor-Zeile → Option (nur für die Vorschau; massgebend ist die Prüfung auf dem Server). */
export function rowToOption(d: DurationRow): DurationOption {
  const opt: DurationOption = { minutes: d.minutes, priceCents: centsOrNull(d.price) ?? 0 };
  const pp = (d.personPrices ?? []).map(centsOrNull);
  if (pp.some((x) => x !== null)) opt.personPrices = pp;
  const from = d.flatFrom?.trim() ? Number(d.flatFrom) : NaN;
  const flat = centsOrNull(d.flatPrice);
  if (Number.isInteger(from) && from >= 1 && flat !== null) {
    opt.flatFromPersons = from;
    opt.flatPriceCents = flat;
  }
  return opt;
}

/**
 * Zeilen für das Formular. Personenpreise über der aktuell eingestellten Höchstzahl bleiben erhalten:
 * Ressourcen mit höherer eigener Höchstzahl nutzen dieselben Vereinspreise.
 */
export function serializeRows(rows: DurationRow[]) {
  return JSON.stringify(rows.map((d) => ({ ...d, personPrices: (d.personPrices ?? []).slice(0, PERSONS_LIMIT) })));
}

function PriceTable({ row, onChange, currency, maxPersons }: { row: DurationRow; onChange: (patch: Partial<DurationRow>) => void; currency: string; maxPersons: number }) {
  const t = useT();
  const fallback = centsOrNull(row.price) ?? 0;
  const flatFrom = row.flatFrom?.trim() ? Number(row.flatFrom) : NaN;
  const lastExplicit = Number.isInteger(flatFrom) && flatFrom >= 1 ? Math.min(maxPersons, flatFrom - 1) : maxPersons;
  const prices = row.personPrices ?? [];
  const setPrice = (i: number, v: string) => {
    const next = [...prices];
    while (next.length <= i) next.push("");
    next[i] = v;
    onChange({ personPrices: next });
  };
  const hiddenPrices = prices.slice(Math.max(0, maxPersons)).filter((v) => v.trim() !== "").length;
  return (
    <div className="space-y-3 rounded-control bg-surface-2 p-3">
      {lastExplicit >= 1 ? (
        <div>
          <p className="text-xs text-ink-3 mb-2">{t("adm1.bk.set.fixedPrices", { currency, price: formatShortMoney(fallback) })}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: lastExplicit }, (_, i) => (
              <Field key={i} label={t("adm1.bk.set.persShort", { n: i + 1 })}>
                <Input inputMode="decimal" value={prices[i] ?? ""} placeholder={(fallback * (i + 1) / 100).toFixed(2)} onChange={(e) => setPrice(i, e.target.value)} aria-label={t(i === 0 ? "adm1.bk.set.priceForOne" : "adm1.bk.set.priceForMany", { n: i + 1, min: row.minutes })} />
              </Field>
            ))}
          </div>
        </div>
      ) : null}
      {hiddenPrices > 0 ? (
        <p className="text-xs text-ink-3">
          {t(hiddenPrices === 1 ? "adm1.bk.set.hiddenPrices.one" : "adm1.bk.set.hiddenPrices.other", { n: hiddenPrices, max: maxPersons })}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("adm1.bk.set.flatFrom")} hint={t("adm1.bk.set.flatFromHint")}>
          <Input type="number" inputMode="numeric" min={1} max={PERSONS_LIMIT} value={row.flatFrom ?? ""} placeholder={t("adm1.bk.set.flatFromPh")} onChange={(e) => onChange({ flatFrom: e.target.value })} />
        </Field>
        <Field label={t("adm1.bk.set.flatPrice", { currency })}>
          <Input inputMode="decimal" value={row.flatPrice ?? ""} placeholder="0.00" onChange={(e) => onChange({ flatPrice: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

export function DurationEditor({ value, onChange, currency, personPricing = false, maxPersons = 1 }: { value: DurationRow[]; onChange: (v: DurationRow[]) => void; currency: string; personPricing?: boolean; maxPersons?: number }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null);
  const patch = (i: number, p: Partial<DurationRow>) => onChange(value.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const priceLabel = t(personPricing ? "adm1.bk.set.pricePerPerson" : "adm1.bk.set.price", { currency });
  return (
    <div className="space-y-3">
      {value.map((d, i) => (
        <div key={i} className={cn("space-y-2", personPricing && i > 0 && "border-t border-line pt-3")}>
          <div className="grid grid-cols-[1fr_1fr_44px] gap-2 items-end">
            <Field label={i === 0 || personPricing ? t("adm1.bk.set.duration") : ""}><Input aria-label={i === 0 || personPricing ? undefined : t("adm1.bk.set.durationN", { n: i + 1 })} type="number" inputMode="numeric" min={5} step={5} value={d.minutes} onChange={(e) => patch(i, { minutes: Number(e.target.value) })} /></Field>
            <Field label={i === 0 || personPricing ? priceLabel : ""}><Input aria-label={i === 0 || personPricing ? undefined : t("adm1.bk.set.priceN", { n: i + 1, currency })} inputMode="decimal" value={d.price} placeholder="0.00" onChange={(e) => patch(i, { price: e.target.value })} /></Field>
            <button type="button" onClick={() => { onChange(value.filter((_, j) => j !== i)); setOpen(null); }} disabled={value.length === 1} aria-label={t("adm1.bk.set.durationRemoveN", { min: d.minutes })} title={t("adm1.bk.set.durationRemove")} className="h-11 w-11 rounded-control text-ink-3 hover:text-accent disabled:opacity-30 flex items-center justify-center"><Trash2 className="h-4 w-4" /></button>
          </div>
          {personPricing ? (
            <>
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}
                className="press flex w-full min-h-11 items-center gap-2 rounded-control border border-line px-3 py-2 text-left text-sm hover:bg-surface-2">
                <Users className="h-4 w-4 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1 text-ink-2">{priceTablePreview(rowToOption(d), maxPersons, true, t)}</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-3 transition-transform", open === i && "rotate-180")} />
              </button>
              {open === i ? <PriceTable row={d} onChange={(p) => patch(i, p)} currency={currency} maxPersons={maxPersons} /> : null}
            </>
          ) : null}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { minutes: (value[value.length - 1]?.minutes ?? 30) + 30, price: "" }])} className="press inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 h-11 px-2 rounded-control hover:bg-surface-2"><Plus className="h-4 w-4" /> {t("adm1.bk.set.durationAdd")}</button>
    </div>
  );
}

export function toRows(opts: DurationOption[]): DurationRow[] {
  return opts.map((o) => ({
    minutes: o.minutes,
    price: (o.priceCents / 100).toFixed(2),
    personPrices: (o.personPrices ?? []).map((p) => (p === null ? "" : (p / 100).toFixed(2))),
    flatFrom: o.flatFromPersons ? String(o.flatFromPersons) : "",
    flatPrice: o.flatPriceCents !== undefined && o.flatFromPersons ? (o.flatPriceCents / 100).toFixed(2) : "",
  }));
}

/** Zahl aus einem Eingabefeld für die Höchstzahl Personen (1 … PERSONS_LIMIT). */
export function clampPersons(v: string, fallback: number) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, PERSONS_LIMIT) : fallback;
}

export function BookingSettingsForm({ settings, providers }: { settings: BookingSettingsView; providers: Array<{ provider: string; enabled: boolean }> }) {
  const t = useT();
  const locale = useLocale();
  const [state, action, pending] = useActionState(saveBookingSettingsAction, null);
  const [durations, setDurations] = useState<DurationRow[]>(toRows(settings.durationOptions));
  const [hours, setHours] = useState<OpeningHours>(settings.openingHours);
  const [allowOnline, setAllowOnline] = useState(settings.allowOnline);
  const [approval, setApproval] = useState(settings.approvalRequired);
  const [personPricing, setPersonPricing] = useState(settings.personPricing);
  const [maxPersonsText, setMaxPersonsText] = useState(String(settings.maxPersons));
  const [flatExclusive, setFlatExclusive] = useState(settings.flatExclusive);
  const [capacityPerPerson, setCapacityPerPerson] = useState(settings.capacityPerPerson);
  const maxPersons = clampPersons(maxPersonsText, 1);
  const enabledProviders = providers.filter((p) => p.enabled).map((p) => p.provider);

  const setDay = (d: number, range: [string, string] | null) => setHours((h) => ({ ...h, [String(d)]: range ? [range] : [] }));

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-5">
      <input type="hidden" name="durationsJson" value={serializeRows(durations)} />
      <input type="hidden" name="openingHoursJson" value={JSON.stringify(hours)} />

      <Card className="animate-rise p-4 space-y-4">
        <h3 className="font-semibold">{t("adm1.bk.set.persons")}</h3>
        <Field label={t("adm1.bk.set.maxPersons")} hint={t("adm1.bk.set.maxPersonsHint")}>
          <Input name="maxPersons" type="number" inputMode="numeric" min={1} max={PERSONS_LIMIT} value={maxPersonsText} onChange={(e) => setMaxPersonsText(e.target.value)} />
        </Field>
        <Switch name="personPricing" checked={personPricing} onChange={setPersonPricing} label={t("adm1.bk.set.personPricing")}
          description={t(personPricing ? "adm1.bk.set.personPricingOn" : "adm1.bk.set.personPricingOff")} />
        <Switch name="flatExclusive" checked={flatExclusive} onChange={setFlatExclusive} label={t("adm1.bk.set.flatExclusive")}
          description={t(flatExclusive ? "adm1.bk.set.flatExclusiveOn" : "adm1.bk.set.flatExclusiveOff")} />
        <Switch name="capacityPerPerson" checked={capacityPerPerson} onChange={setCapacityPerPerson} label={t("adm1.bk.set.capacityPerPerson")}
          description={t(capacityPerPerson ? "adm1.bk.set.capacityPerPersonOn" : "adm1.bk.set.capacityPerPersonOff")} />
      </Card>

      <Card className="animate-rise p-4 space-y-4">
        <h3 className="font-semibold">{t("adm1.bk.set.durationsTitle")}</h3>
        {personPricing ? <p className="text-xs text-ink-3">{t("adm1.bk.set.personPricingHelp")}</p> : null}
        <DurationEditor value={durations} onChange={setDurations} currency={settings.currency} personPricing={personPricing} maxPersons={maxPersons} />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("adm1.bk.set.step")} hint={t("adm1.bk.set.stepHint")}><Input name="slotStepMinutes" type="number" inputMode="numeric" min={5} step={5} defaultValue={settings.slotStepMinutes} /></Field>
          <Field label={t("adm1.bk.set.currency")}><Select name="currency" defaultValue={settings.currency}><option value="CHF">CHF</option><option value="EUR">EUR</option></Select></Field>
        </div>
      </Card>

      <Card className="animate-rise p-4 space-y-4">
        <h3 className="font-semibold">{t("adm1.bk.set.discountTitle")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("adm1.bk.set.discount")} hint={t("adm1.bk.set.discountHint")}><Input name="lastMinuteDiscountPercent" type="number" inputMode="numeric" min={0} max={100} defaultValue={settings.lastMinuteDiscountPercent} /></Field>
          <Field label={t("adm1.bk.set.discountWindow")}><Input name="lastMinuteWindowHours" type="number" inputMode="numeric" min={1} defaultValue={settings.lastMinuteWindowHours} /></Field>
        </div>
      </Card>

      <Card className="animate-rise p-4 space-y-4">
        <h3 className="font-semibold">{t("adm1.bk.set.hours")}</h3>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const r = hours[String(d)]?.[0] ?? null;
            const day = dayName(d, locale, "long");
            return (
              <div key={d} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 sm:gap-2 items-center">
                <span className="text-sm font-medium" aria-hidden>{dayName(d, locale, "short")}</span>
                <Input type="time" aria-label={t("adm1.bk.set.dayFrom", { day })} className="min-w-0 px-2 sm:px-3.5" value={r?.[0] ?? ""} disabled={!r} onChange={(e) => setDay(d, [e.target.value, r?.[1] ?? "22:00"])} />
                <Input type="time" aria-label={t("adm1.bk.set.dayTo", { day })} className="min-w-0 px-2 sm:px-3.5" value={r?.[1] ?? ""} disabled={!r} onChange={(e) => setDay(d, [r?.[0] ?? "08:00", e.target.value])} />
                <button type="button" role="switch" aria-checked={!!r} aria-label={t("adm1.bk.set.dayOpen", { day })} onClick={() => setDay(d, r ? null : ["08:00", "22:00"])} className={cn("h-11 min-w-12 px-2.5 rounded-control text-xs font-medium border", r ? "border-line text-ink-2" : "bg-surface-2 border-transparent text-ink-3")}>{t(r ? "adm1.bk.set.open" : "adm1.bk.set.closed")}</button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="animate-rise p-4 space-y-4">
        <h3 className="font-semibold">{t("adm1.bk.set.rules")}</h3>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="approvalRequired" checked={approval} onChange={(e) => setApproval(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--ink)]" />
          <span><span className="block text-sm font-medium">{t("adm1.bk.set.approval")}</span><span className="block text-xs text-ink-3">{t(approval ? "adm1.bk.set.approvalOn" : "adm1.bk.set.approvalOff")}</span></span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("adm1.bk.set.lead")} hint={t("adm1.bk.set.leadHint")}><Input name="minLeadMinutes" type="number" inputMode="numeric" min={0} defaultValue={settings.minLeadMinutes} /></Field>
          <Field label={t("adm1.bk.set.advance")}><Input name="maxAdvanceDays" type="number" inputMode="numeric" min={1} defaultValue={settings.maxAdvanceDays} /></Field>
          <Field label={t("adm1.bk.set.cancel")} hint={t("adm1.bk.set.cancelHint")}><Input name="cancellationHours" type="number" inputMode="numeric" min={0} defaultValue={settings.cancellationHours} /></Field>
        </div>
      </Card>

      <Card className="animate-rise p-4 space-y-4">
        <h3 className="font-semibold">{t("adm1.bk.set.payment")}</h3>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="allowInvoice" defaultChecked={settings.allowInvoice} className="mt-1 h-5 w-5 accent-[var(--ink)]" />
          <span><span className="block text-sm font-medium">{t("adm1.bk.set.invoice")}</span><span className="block text-xs text-ink-3">{t("adm1.bk.set.invoiceHint")}</span></span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="allowOnline" checked={allowOnline} onChange={(e) => setAllowOnline(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--ink)]" />
          <span><span className="block text-sm font-medium">{t("adm1.bk.set.online")}</span><span className="block text-xs text-ink-3">{t("adm1.bk.set.onlineHint")}</span></span>
        </label>
        <Field label={t("adm1.bk.set.provider")}>
          <Select name="onlineProvider" defaultValue={settings.onlineProvider} disabled={!allowOnline}>
            <option value="NONE">{t("adm1.bk.set.providerNone")}</option>
            {PAYMENT_PROVIDERS.map((p) => <option key={p.key} value={p.key} disabled={!enabledProviders.includes(p.key)}>{p.label}{enabledProviders.includes(p.key) ? "" : ` (${t("adm1.bk.pay.notSetUp")})`}</option>)}
          </Select>
        </Field>
        <p className="text-xs text-ink-3">{t("adm1.bk.set.bothHint")}</p>
      </Card>

      <Card className="animate-rise p-4 space-y-4">
        <h3 className="font-semibold">{t("adm1.bk.set.invoicing")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("adm1.bk.set.prefix")}><Input name="invoicePrefix" defaultValue={settings.invoicePrefix} placeholder="R-" /></Field>
          <Field label={t("adm1.bk.set.dueDays")}><Input name="invoiceDueDays" type="number" inputMode="numeric" min={1} defaultValue={settings.invoiceDueDays} /></Field>
        </div>
        <p className="text-xs text-ink-3">{t("adm1.bk.set.profileLead")} <a href="/admin/billing/settings" className="underline">{t("adm1.bk.set.profileLink")}</a>{t("adm1.bk.set.profileTail")}</p>
        <Field label={t("adm1.bk.set.invoiceNote")}><Textarea name="invoiceNote" defaultValue={settings.invoiceNote ?? ""} className="min-h-16" placeholder={t("adm1.bk.set.invoiceNotePh")} /></Field>
      </Card>

      {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <div className="sticky bottom-24 md:bottom-4"><SubmitButton pending={pending} size="lg" className="w-full shadow-lg">{t("adm1.bk.set.save")}</SubmitButton></div>
    </form>
  );
}
