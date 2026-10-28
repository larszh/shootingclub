"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Plus, Trash2, Users } from "lucide-react";
import { saveBookingSettingsAction } from "@/modules/bookings/actions";
import { PAYMENT_PROVIDERS, PERSONS_LIMIT, WEEKDAYS, type DurationOption, type OpeningHours } from "@/modules/bookings/types";
import { formatShortMoney, priceTablePreview } from "@/modules/bookings/pricing";
import type { BookingSettingsView } from "@/modules/bookings/queries";
import { Alert, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { parseMoneyToCents } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Zeile im Dauer-Editor; Beträge bleiben Text, bis der Server sie prüft. */
export type DurationRow = { minutes: number; price: string; personPrices?: string[]; flatFrom?: string; flatPrice?: string };

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

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
          <p className="text-xs text-ink-3 mb-2">Feste Preise je Gruppengrösse ({currency}). Leer = {formatShortMoney(fallback)} pro Person.</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: lastExplicit }, (_, i) => (
              <Field key={i} label={`${i + 1} Pers.`}>
                <Input inputMode="decimal" value={prices[i] ?? ""} placeholder={(fallback * (i + 1) / 100).toFixed(2)} onChange={(e) => setPrice(i, e.target.value)} aria-label={`Preis für ${i + 1} ${i === 0 ? "Person" : "Personen"} (${row.minutes} Min.)`} />
              </Field>
            ))}
          </div>
        </div>
      ) : null}
      {hiddenPrices > 0 ? (
        <p className="text-xs text-ink-3">
          {hiddenPrices === 1 ? "1 weiterer Preis" : `${hiddenPrices} weitere Preise`} für Gruppen über {maxPersons} {maxPersons === 1 ? "Person" : "Personen"} {hiddenPrices === 1 ? "bleibt" : "bleiben"} gespeichert (für Ressourcen mit höherer Personenzahl).
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Pauschal ab … Personen" hint="leer = keine Pauschale">
          <Input type="number" inputMode="numeric" min={1} max={PERSONS_LIMIT} value={row.flatFrom ?? ""} placeholder="z.B. 4" onChange={(e) => onChange({ flatFrom: e.target.value })} />
        </Field>
        <Field label={`Pauschalpreis (${currency})`}>
          <Input inputMode="decimal" value={row.flatPrice ?? ""} placeholder="0.00" onChange={(e) => onChange({ flatPrice: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

export function DurationEditor({ value, onChange, currency, personPricing = false, maxPersons = 1 }: { value: DurationRow[]; onChange: (v: DurationRow[]) => void; currency: string; personPricing?: boolean; maxPersons?: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const patch = (i: number, p: Partial<DurationRow>) => onChange(value.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const priceLabel = personPricing ? `Preis pro Person (${currency})` : `Preis (${currency})`;
  return (
    <div className="space-y-3">
      {value.map((d, i) => (
        <div key={i} className={cn("space-y-2", personPricing && i > 0 && "border-t border-line pt-3")}>
          <div className="grid grid-cols-[1fr_1fr_40px] gap-2 items-end">
            <Field label={i === 0 || personPricing ? "Dauer (Minuten)" : ""}><Input aria-label={i === 0 || personPricing ? undefined : `Dauer ${i + 1} (Minuten)`} type="number" inputMode="numeric" min={5} step={5} value={d.minutes} onChange={(e) => patch(i, { minutes: Number(e.target.value) })} /></Field>
            <Field label={i === 0 || personPricing ? priceLabel : ""}><Input aria-label={i === 0 || personPricing ? undefined : `Preis ${i + 1} (${currency})`} inputMode="decimal" value={d.price} placeholder="0.00" onChange={(e) => patch(i, { price: e.target.value })} /></Field>
            <button type="button" onClick={() => { onChange(value.filter((_, j) => j !== i)); setOpen(null); }} disabled={value.length === 1} aria-label={`Dauer ${d.minutes} Minuten entfernen`} title="Dauer entfernen" className="h-11 w-10 rounded-control text-ink-3 hover:text-accent disabled:opacity-30 flex items-center justify-center"><Trash2 className="h-4 w-4" /></button>
          </div>
          {personPricing ? (
            <>
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}
                className="press flex w-full min-h-11 items-center gap-2 rounded-control border border-line px-3 py-2 text-left text-sm hover:bg-surface-2">
                <Users className="h-4 w-4 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1 text-ink-2">{priceTablePreview(rowToOption(d), maxPersons, true)}</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-3 transition-transform", open === i && "rotate-180")} />
              </button>
              {open === i ? <PriceTable row={d} onChange={(p) => patch(i, p)} currency={currency} maxPersons={maxPersons} /> : null}
            </>
          ) : null}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { minutes: (value[value.length - 1]?.minutes ?? 30) + 30, price: "" }])} className="press inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 h-11 px-2 rounded-control hover:bg-surface-2"><Plus className="h-4 w-4" /> Dauer hinzufügen</button>
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
        <h3 className="font-semibold">Personen</h3>
        <Field label="Höchstens Personen pro Buchung" hint="1 = keine Auswahl beim Buchen. Pro Ressource anpassbar.">
          <Input name="maxPersons" type="number" inputMode="numeric" min={1} max={PERSONS_LIMIT} value={maxPersonsText} onChange={(e) => setMaxPersonsText(e.target.value)} />
        </Field>
        <Switch name="personPricing" checked={personPricing} onChange={setPersonPricing} label="Preise pro Person"
          description={personPricing ? "Der Preis richtet sich nach der Anzahl Personen. Pro Dauer lässt sich eine Preistabelle und eine Pauschale festlegen." : "Ein Preis pro Buchung, egal wie viele Personen kommen."} />
        <Switch name="flatExclusive" checked={flatExclusive} onChange={setFlatExclusive} label="Pauschal belegt die ganze Ressource"
          description={flatExclusive ? "Wer den Pauschalpreis bezahlt, hat Raum oder Anlage für sich allein." : "Pauschalbuchungen belegen nur ihre Plätze, andere können parallel buchen."} />
        <Switch name="capacityPerPerson" checked={capacityPerPerson} onChange={setCapacityPerPerson} label="Jede Person belegt einen Platz"
          description={capacityPerPerson ? "Beispiel: 25 m Stand mit 8 Plätzen – eine Buchung für 3 Personen belegt 3 Plätze." : "Jede Buchung belegt einen Platz, unabhängig von der Anzahl Personen."} />
      </Card>

      <Card className="animate-rise p-4 space-y-4">
        <h3 className="font-semibold">Dauer und Preise</h3>
        {personPricing ? <p className="text-xs text-ink-3">«Preis pro Person» gilt, wenn für eine Gruppengrösse kein fester Preis eingetragen ist. Tippe auf die Preiszeile, um die Tabelle zu bearbeiten.</p> : null}
        <DurationEditor value={durations} onChange={setDurations} currency={settings.currency} personPricing={personPricing} maxPersons={maxPersons} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Raster (Minuten)" hint="Startzeiten alle … Minuten"><Input name="slotStepMinutes" type="number" inputMode="numeric" min={5} step={5} defaultValue={settings.slotStepMinutes} /></Field>
          <Field label="Währung"><Select name="currency" defaultValue={settings.currency}><option value="CHF">CHF</option><option value="EUR">EUR</option></Select></Field>
        </div>
      </Card>

      <Card className="animate-rise p-4 space-y-4">
        <h3 className="font-semibold">Rabatt für spontane Buchungen</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rabatt (%)" hint="0 = kein Rabatt"><Input name="lastMinuteDiscountPercent" type="number" inputMode="numeric" min={0} max={100} defaultValue={settings.lastMinuteDiscountPercent} /></Field>
          <Field label="Gilt bei Buchung innerhalb von (Stunden)"><Input name="lastMinuteWindowHours" type="number" inputMode="numeric" min={1} defaultValue={settings.lastMinuteWindowHours} /></Field>
        </div>
      </Card>

      <Card className="animate-rise p-4 space-y-4">
        <h3 className="font-semibold">Öffnungszeiten</h3>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const r = hours[String(d)]?.[0] ?? null;
            const day = DAY_NAMES[d];
            return (
              <div key={d} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 sm:gap-2 items-center">
                <span className="text-sm font-medium" aria-hidden>{WEEKDAYS[d]}</span>
                <Input type="time" aria-label={`${day} von`} className="min-w-0 px-2 sm:px-3.5" value={r?.[0] ?? ""} disabled={!r} onChange={(e) => setDay(d, [e.target.value, r?.[1] ?? "22:00"])} />
                <Input type="time" aria-label={`${day} bis`} className="min-w-0 px-2 sm:px-3.5" value={r?.[1] ?? ""} disabled={!r} onChange={(e) => setDay(d, [r?.[0] ?? "08:00", e.target.value])} />
                <button type="button" role="switch" aria-checked={!!r} aria-label={`${day} geöffnet`} onClick={() => setDay(d, r ? null : ["08:00", "22:00"])} className={cn("h-11 min-w-12 px-2.5 rounded-control text-xs font-medium border", r ? "border-line text-ink-2" : "bg-surface-2 border-transparent text-ink-3")}>{r ? "offen" : "zu"}</button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="animate-rise p-4 space-y-4">
        <h3 className="font-semibold">Regeln</h3>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="approvalRequired" checked={approval} onChange={(e) => setApproval(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--ink)]" />
          <span><span className="block text-sm font-medium">Buchungen müssen freigegeben werden</span><span className="block text-xs text-ink-3">{approval ? "Anfragen erscheinen unter «Freigaben». Erst nach Freigabe wird bezahlt bzw. die Rechnung erstellt." : "Buchungen sind sofort gültig."}</span></span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Vorlauf (Min.)" hint="Frühestens … Minuten vor Beginn"><Input name="minLeadMinutes" type="number" inputMode="numeric" min={0} defaultValue={settings.minLeadMinutes} /></Field>
          <Field label="Vorausbuchung (Tage)"><Input name="maxAdvanceDays" type="number" inputMode="numeric" min={1} defaultValue={settings.maxAdvanceDays} /></Field>
          <Field label="Storno bis (Std.)" hint="Mitglieder können bis … Stunden vorher stornieren"><Input name="cancellationHours" type="number" inputMode="numeric" min={0} defaultValue={settings.cancellationHours} /></Field>
        </div>
      </Card>

      <Card className="animate-rise p-4 space-y-4">
        <h3 className="font-semibold">Zahlung</h3>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="allowInvoice" defaultChecked={settings.allowInvoice} className="mt-1 h-5 w-5 accent-[var(--ink)]" />
          <span><span className="block text-sm font-medium">Rechnung</span><span className="block text-xs text-ink-3">Es wird automatisch eine Rechnung mit QR-Code erstellt (IBAN im Rechnungsprofil hinterlegen).</span></span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="allowOnline" checked={allowOnline} onChange={(e) => setAllowOnline(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--ink)]" />
          <span><span className="block text-sm font-medium">Online-Zahlung (Direktzahlung)</span><span className="block text-xs text-ink-3">Karte, TWINT usw. über einen Zahlungsanbieter. Anbieter zuerst unter «Zahlungsanbieter» einrichten.</span></span>
        </label>
        <Field label="Anbieter für Online-Zahlung">
          <Select name="onlineProvider" defaultValue={settings.onlineProvider} disabled={!allowOnline}>
            <option value="NONE">Keiner</option>
            {PAYMENT_PROVIDERS.map((p) => <option key={p.key} value={p.key} disabled={!enabledProviders.includes(p.key)}>{p.label}{enabledProviders.includes(p.key) ? "" : " (nicht eingerichtet)"}</option>)}
          </Select>
        </Field>
        <p className="text-xs text-ink-3">Sind beide Arten aktiv, wählen Mitglieder beim Buchen. Kostenlose Buchungen brauchen keine Zahlung.</p>
      </Card>

      <Card className="animate-rise p-4 space-y-4">
        <h3 className="font-semibold">Rechnungsstellung</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nummernpräfix"><Input name="invoicePrefix" defaultValue={settings.invoicePrefix} placeholder="R-" /></Field>
          <Field label="Zahlungsfrist (Tage)"><Input name="invoiceDueDays" type="number" inputMode="numeric" min={1} defaultValue={settings.invoiceDueDays} /></Field>
        </div>
        <p className="text-xs text-ink-3">Zahlungsempfänger und IBAN für die QR-Rechnung werden im <a href="/admin/billing/settings" className="underline">Rechnungsprofil</a> gepflegt und gelten für Reservationen, Mitgliederbeiträge und Munition.</p>
        <Field label="Hinweistext auf der Rechnung (optional)"><Textarea name="invoiceNote" defaultValue={settings.invoiceNote ?? ""} className="min-h-16" placeholder="z.B. Vielen Dank für die Unterstützung unseres Vereins." /></Field>
      </Card>

      {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <div className="sticky bottom-24 md:bottom-4"><SubmitButton pending={pending} size="lg" className="w-full shadow-lg">Einstellungen speichern</SubmitButton></div>
    </form>
  );
}
