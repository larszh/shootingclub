"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Clock, CreditCard, FileText, MapPin, Tag } from "lucide-react";
import { createBookingAction } from "@/modules/bookings/actions";
import { fetchSlotsAction, type SlotDto } from "@/modules/bookings/slot-actions";
import { formatDuration, resourceKindLabel, type DurationOption } from "@/modules/bookings/types";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton, Spinner } from "@/components/ui/form";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type ResourceDto = { id: string; name: string; kind: string; capacity: number; description: string | null; durationOptions: DurationOption[] | null };
type SettingsDto = {
  currency: string; durationOptions: DurationOption[]; allowInvoice: boolean; allowOnline: boolean; onlineProvider: string; approvalRequired: boolean;
  lastMinuteDiscountPercent: number; lastMinuteWindowHours: number; maxAdvanceDays: number; cancellationHours: number;
};

function shiftDate(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function weekdayLabel(dateStr: string) {
  return new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${dateStr}T12:00:00Z`));
}

export type WizardPrefill = { resourceId: string; duration: number; date: string; time: string };

export function BookingWizard({ resources, settings, today, prefill }: { resources: ResourceDto[]; settings: SettingsDto; today: string; prefill?: WizardPrefill | null }) {
  const [state, action] = useActionState(createBookingAction, null);
  const optionsFor = (rid: string) => resources.find((r) => r.id === rid)?.durationOptions ?? settings.durationOptions;
  const [sel, setSel] = useState(() => {
    const pre = prefill && resources.some((r) => r.id === prefill.resourceId) ? prefill : null;
    const resourceId = pre?.resourceId ?? resources[0]?.id ?? "";
    const opts = optionsFor(resourceId);
    const duration = pre && opts.some((o) => o.minutes === pre.duration) ? pre.duration : opts[0]?.minutes ?? 60;
    return { resourceId, duration, date: pre?.date && pre.date >= today ? pre.date : today };
  });
  const [prefillNote, setPrefillNote] = useState<string | null>(null);
  const { resourceId, duration, date } = sel;
  const resource = resources.find((r) => r.id === resourceId);
  const options = optionsFor(resourceId);
  const [slots, setSlots] = useState<SlotDto[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [loading, start] = useTransition();
  const [paymentMethod, setPaymentMethod] = useState<"INVOICE" | "ONLINE">(settings.allowOnline ? "ONLINE" : "INVOICE");

  // Nur die Antwort der jeweils letzten Anfrage übernehmen (schnelles Blättern).
  const requestId = useRef(0);
  const load = (next: { resourceId: string; duration: number; date: string }) => {
    start(async () => {
      const id = ++requestId.current;
      const r = await fetchSlotsAction(next.resourceId, next.date, next.duration);
      if (id !== requestId.current) return;
      setSlots(r.slots);
    });
  };
  const update = (patch: Partial<typeof sel>) => {
    const next = { ...sel, ...patch };
    if (patch.resourceId) {
      const opts = optionsFor(patch.resourceId);
      if (!opts.some((o) => o.minutes === next.duration)) next.duration = opts[0]?.minutes ?? 60;
    }
    setSel(next);
    setTime(null);
    setPrefillNote(null);
    load(next);
  };
  const setResourceId = (id: string) => update({ resourceId: id });
  const setDuration = (d: number) => update({ duration: d });
  const setDate = (d: string) => update({ date: d });

  // Erstes Laden nach dem Mounten (Zustand wird im Callback gesetzt).
  useEffect(() => {
    if (!sel.resourceId) return;
    let cancelled = false;
    const id = ++requestId.current;
    fetchSlotsAction(sel.resourceId, sel.date, sel.duration).then((r) => {
      if (cancelled || id !== requestId.current) return;
      setSlots(r.slots);
      if (prefill && prefill.resourceId === sel.resourceId && prefill.date === sel.date) {
        const slot = r.slots.find((x) => x.time === prefill.time);
        if (slot?.available) {
          setTime(prefill.time);
          setPrefillNote(`Gleiche Zeit wie letztes Mal (${prefill.time} Uhr) ist frei und vorausgewählt.`);
        } else {
          setPrefillNote(`${prefill.time} Uhr ist an diesem Tag nicht frei${slot?.reason ? ` (${slot.reason})` : ""}. Bitte eine andere Zeit wählen.`);
        }
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = slots?.find((s) => s.time === time && s.available) ?? null;
  const maxDate = shiftDate(today, settings.maxAdvanceDays);
  const payChoices = useMemo(() => {
    const c: Array<"INVOICE" | "ONLINE"> = [];
    if (settings.allowInvoice) c.push("INVOICE");
    if (settings.allowOnline && settings.onlineProvider !== "NONE") c.push("ONLINE");
    return c;
  }, [settings]);
  const needsPayment = (selected?.totalCents ?? 0) > 0;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="resourceId" value={resourceId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time ?? ""} />
      <input type="hidden" name="durationMinutes" value={duration} />
      {needsPayment && payChoices.length > 1 ? <input type="hidden" name="paymentMethod" value={paymentMethod} /> : null}

      {/* 1 Ressource */}
      <section className="animate-rise">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">1 · Was</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {resources.map((r) => (
            <button key={r.id} type="button" onClick={() => setResourceId(r.id)}
              className={cn("press text-left rounded-card border p-3.5 transition-colors", resourceId === r.id ? "border-ink bg-surface" : "border-line bg-surface hover:border-ink/30")}>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-ink-3" /><span className="font-medium">{r.name}</span></div>
              <div className="text-xs text-ink-3 mt-0.5">{resourceKindLabel(r.kind)}{r.capacity > 1 ? ` · ${r.capacity} Plätze` : ""}{r.description ? ` · ${r.description}` : ""}</div>
            </button>
          ))}
        </div>
      </section>

      {/* 2 Dauer */}
      <section className="animate-rise [animation-delay:60ms]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">2 · Wie lange</h2>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button key={o.minutes} type="button" onClick={() => setDuration(o.minutes)}
              className={cn("press h-11 rounded-control px-4 text-sm font-medium border", duration === o.minutes ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2")}>
              {formatDuration(o.minutes)}<span className={cn("ml-2 text-xs", duration === o.minutes ? "text-bg/70" : "text-ink-3")}>{o.priceCents ? formatMoney(o.priceCents, settings.currency) : "gratis"}</span>
            </button>
          ))}
        </div>
        {settings.lastMinuteDiscountPercent > 0 ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ok"><Tag className="h-3.5 w-3.5" /> {settings.lastMinuteDiscountPercent}% Rabatt bei Buchung innerhalb von {settings.lastMinuteWindowHours} Stunden vor Beginn.</p>
        ) : null}
      </section>

      {/* 3 Datum + Zeit */}
      <section className="animate-rise [animation-delay:120ms]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">3 · Wann</h2>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Vorheriger Tag" onClick={() => setDate(shiftDate(date, -1))} disabled={date <= today} className="press h-11 w-11 rounded-full hover:bg-surface-2 disabled:opacity-30 flex items-center justify-center"><ChevronLeft className="h-5 w-5" /></button>
            <div className="flex-1 text-center">
              <div className="font-semibold capitalize">{weekdayLabel(date)}</div>
              <input type="date" aria-label="Datum wählen" value={date} min={today} max={maxDate} onChange={(e) => e.target.value && setDate(e.target.value)} className="text-xs text-ink-3 bg-transparent text-center" />
            </div>
            <button type="button" aria-label="Nächster Tag" onClick={() => setDate(shiftDate(date, 1))} disabled={date >= maxDate} className="press h-11 w-11 rounded-full hover:bg-surface-2 disabled:opacity-30 flex items-center justify-center"><ChevronRight className="h-5 w-5" /></button>
          </div>
          <div className="flex gap-1.5 justify-center mt-2 py-1">
            {[0, 1, 2].map((d) => { const ds = shiftDate(today, d); return <button key={d} type="button" aria-pressed={date === ds} disabled={ds > maxDate} onClick={() => setDate(ds)} className={cn("relative h-7 rounded-full px-3 text-xs font-medium disabled:opacity-30 after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']", date === ds ? "bg-ink text-bg" : "bg-surface-2 text-ink-2")}>{d === 0 ? "Heute" : d === 1 ? "Morgen" : "Übermorgen"}</button>; })}
          </div>
          {prefillNote ? <p className="mt-2 rounded-control bg-surface-2 px-3 py-2 text-xs text-ink-2">{prefillNote}</p> : null}
          <div className="mt-3 min-h-16">
            {loading || (slots === null && resourceId) ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-3"><Spinner /> Verfügbarkeit wird geladen…</div>
            ) : !slots || slots.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-3">An diesem Tag geschlossen oder keine passende Zeit.</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {slots.map((s) => (
                  <button key={s.time} type="button" disabled={!s.available} onClick={() => setTime(s.time)} title={s.reason}
                    className={cn("press h-11 rounded-control text-sm font-medium tabular-nums border transition-colors",
                      time === s.time ? "bg-ink text-bg border-ink" : s.available ? "bg-surface border-line hover:border-ink/40" : "bg-surface-2 border-transparent text-ink-3/60 line-through cursor-not-allowed")}>
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* 4 Zusammenfassung */}
      <section className={cn("animate-rise [animation-delay:180ms]", !selected && "opacity-50 pointer-events-none")}>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">4 · Bestätigen</h2>
        <Card className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">{resource?.name}</div>
              <div className="text-sm text-ink-3 inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {weekdayLabel(date)}, {time ?? "–"} Uhr · {formatDuration(duration)}</div>
            </div>
            <div className="text-right">
              {selected && selected.discountCents > 0 ? <div className="text-xs text-ink-3 line-through tabular-nums">{formatMoney(selected.basePriceCents, settings.currency)}</div> : null}
              <div className="text-xl font-semibold tabular-nums">{selected ? (selected.totalCents ? formatMoney(selected.totalCents, settings.currency) : "gratis") : "–"}</div>
              {selected?.discountReason ? <div className="text-xs text-ok">{selected.discountReason}</div> : null}
            </div>
          </div>
          {needsPayment && payChoices.length > 1 ? (
            <div className="grid grid-cols-2 gap-2">
              {payChoices.map((c) => (
                <button key={c} type="button" onClick={() => setPaymentMethod(c)}
                  className={cn("press h-12 rounded-control border text-sm font-medium inline-flex items-center justify-center gap-2", paymentMethod === c ? "bg-ink text-bg border-ink" : "bg-surface border-line")}>
                  {c === "ONLINE" ? <><CreditCard className="h-4 w-4" /> Jetzt online zahlen</> : <><FileText className="h-4 w-4" /> Rechnung</>}
                </button>
              ))}
            </div>
          ) : needsPayment && payChoices.length === 1 ? (
            <p className="text-sm text-ink-3">{payChoices[0] === "ONLINE" ? "Bezahlung online direkt nach der Buchung." : "Du erhältst eine Rechnung."}</p>
          ) : null}
          <Field label="Bemerkung (optional)"><Input name="note" placeholder="z.B. Training mit 2 Personen" maxLength={191} /></Field>
          <p className="text-xs text-ink-3">
            {settings.approvalRequired ? "Die Buchung wird von der Verwaltung geprüft und freigegeben. " : "Die Buchung ist sofort gültig. "}
            {settings.cancellationHours > 0 ? `Kostenlose Stornierung bis ${settings.cancellationHours} Stunden vor Beginn.` : ""}
          </p>
        </Card>
      </section>

      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <div className="sticky bottom-24 md:bottom-4">
        <SubmitButton size="lg" className="w-full shadow-lg" disabled={!selected} pendingText="Wird gebucht…">
          {selected && needsPayment && (payChoices.length === 1 ? payChoices[0] : paymentMethod) === "ONLINE" && !settings.approvalRequired ? "Buchen und bezahlen" : settings.approvalRequired ? "Anfrage senden" : "Verbindlich buchen"}
        </SubmitButton>
      </div>
    </form>
  );
}
