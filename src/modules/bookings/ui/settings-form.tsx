"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveBookingSettingsAction } from "@/modules/bookings/actions";
import { PAYMENT_PROVIDERS, WEEKDAYS, type DurationOption, type OpeningHours } from "@/modules/bookings/types";
import type { BookingSettingsView } from "@/modules/bookings/queries";
import { Alert, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type DurationRow = { minutes: number; price: string };

export function DurationEditor({ value, onChange, currency }: { value: DurationRow[]; onChange: (v: DurationRow[]) => void; currency: string }) {
  return (
    <div className="space-y-2">
      {value.map((d, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_40px] gap-2 items-end">
          <Field label={i === 0 ? "Dauer (Minuten)" : ""}><Input type="number" inputMode="numeric" min={5} step={5} value={d.minutes} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, minutes: Number(e.target.value) } : x)))} /></Field>
          <Field label={i === 0 ? `Preis (${currency})` : ""}><Input inputMode="decimal" value={d.price} placeholder="0.00" onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} /></Field>
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} disabled={value.length === 1} className="h-11 w-10 rounded-control text-ink-3 hover:text-accent disabled:opacity-30 flex items-center justify-center"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { minutes: (value[value.length - 1]?.minutes ?? 30) + 30, price: "" }])} className="press inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 h-9 px-2 rounded-control hover:bg-surface-2"><Plus className="h-4 w-4" /> Dauer hinzufügen</button>
    </div>
  );
}

export function toRows(opts: DurationOption[]): DurationRow[] {
  return opts.map((o) => ({ minutes: o.minutes, price: (o.priceCents / 100).toFixed(2) }));
}

export function BookingSettingsForm({ settings, providers }: { settings: BookingSettingsView; providers: Array<{ provider: string; enabled: boolean }> }) {
  const [state, action] = useActionState(saveBookingSettingsAction, null);
  const [durations, setDurations] = useState<DurationRow[]>(toRows(settings.durationOptions));
  const [hours, setHours] = useState<OpeningHours>(settings.openingHours);
  const [allowOnline, setAllowOnline] = useState(settings.allowOnline);
  const [approval, setApproval] = useState(settings.approvalRequired);
  const enabledProviders = providers.filter((p) => p.enabled).map((p) => p.provider);

  const setDay = (d: number, range: [string, string] | null) => setHours((h) => ({ ...h, [String(d)]: range ? [range] : [] }));

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="durationsJson" value={JSON.stringify(durations)} />
      <input type="hidden" name="openingHoursJson" value={JSON.stringify(hours)} />

      <Card className="animate-rise p-4 space-y-4">
        <h3 className="font-semibold">Dauer und Preise</h3>
        <DurationEditor value={durations} onChange={setDurations} currency={settings.currency} />
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
            return (
              <div key={d} className="grid grid-cols-[44px_1fr_1fr_auto] gap-2 items-center">
                <span className="text-sm font-medium">{WEEKDAYS[d]}</span>
                <Input type="time" value={r?.[0] ?? ""} disabled={!r} onChange={(e) => setDay(d, [e.target.value, r?.[1] ?? "22:00"])} />
                <Input type="time" value={r?.[1] ?? ""} disabled={!r} onChange={(e) => setDay(d, [r?.[0] ?? "08:00", e.target.value])} />
                <button type="button" onClick={() => setDay(d, r ? null : ["08:00", "22:00"])} className={cn("h-11 px-3 rounded-control text-xs font-medium border", r ? "border-line text-ink-2" : "bg-surface-2 border-transparent text-ink-3")}>{r ? "offen" : "zu"}</button>
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
        <p className="text-xs text-ink-3">Zahlungsempfänger und IBAN für die QR-Rechnung werden im <a href="/admin/billing/settings" className="underline">Rechnungsprofil</a> gepflegt und gelten für Reservationen und Mitgliederbeiträge.</p>
        <Field label="Hinweistext auf der Rechnung (optional)"><Textarea name="invoiceNote" defaultValue={settings.invoiceNote ?? ""} className="min-h-16" placeholder="z.B. Vielen Dank für die Unterstützung unseres Vereins." /></Field>
      </Card>

      {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <div className="sticky bottom-24 md:bottom-4"><SubmitButton size="lg" className="w-full shadow-lg">Einstellungen speichern</SubmitButton></div>
    </form>
  );
}
