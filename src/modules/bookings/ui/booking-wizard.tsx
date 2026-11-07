"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Clock, CreditCard, FileText, Info, MapPin, Tag, Users } from "lucide-react";
import { createBookingAction } from "@/modules/bookings/actions";
import { fetchSlotsAction, type SlotDto, type SlotsResult } from "@/modules/bookings/slot-actions";
import { createGuestBookingAction, fetchGuestSlotsAction } from "@/modules/sharing/actions";
import { applyPriceFactorCents } from "@/modules/sharing/logic";
import { formatDuration, type DurationOption } from "@/modules/bookings/types";
import { basePriceFor, maxPersonsFor } from "@/modules/bookings/pricing";
import { discountReasonLabel, formatDayLabel, personsText, placesText, resourceKindLabelT, slotErrorLabel, slotReasonLabel, wholeResourceLabelT, windowHintLabel } from "@/modules/bookings/i18n";
import { getT, type Locale } from "@/lib/i18n/core";
import { PersonsStepper } from "./persons-stepper";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton, Spinner } from "@/components/ui/form";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type ResourceDto = {
  id: string; name: string; kind: string; capacity: number; maxPersons: number | null; description: string | null; durationOptions: DurationOption[] | null;
  /** Gemeinsame Anlage: Preisfaktor des Partnervereins in Prozent (Standard 100). */
  priceFactorPercent?: number;
  /** Gemeinsame Anlage: Hinweis des Eigentümers. */
  shareNote?: string | null;
};
type SettingsDto = {
  currency: string; durationOptions: DurationOption[]; allowInvoice: boolean; allowOnline: boolean; onlineProvider: string; approvalRequired: boolean;
  lastMinuteDiscountPercent: number; lastMinuteWindowHours: number; maxAdvanceDays: number; cancellationHours: number;
  personPricing: boolean; maxPersons: number; flatExclusive: boolean; capacityPerPerson: boolean;
};

function shiftDate(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type WizardPrefill = { resourceId: string; duration: number; date: string; time: string; persons?: number };

/**
 * Reservations-Assistent. Mit `shared` bucht ein Mitglied eine Anlage eines Partnervereins:
 * Zeiten und Buchung laufen über die Gast-Actions (Freigabe wird serverseitig geprüft), bezahlt wird per Rechnung.
 */
export function BookingWizard({ resources, settings, today, prefill, shared, locale = "de" }: { resources: ResourceDto[]; settings: SettingsDto; today: string; prefill?: WizardPrefill | null; shared?: { ownerName: string } | null; locale?: Locale }) {
  const t = useMemo(() => getT(locale), [locale]);
  const weekdayLabel = (d: string) => {
    // Nur den ersten Buchstaben gross schreiben (FR/IT: «Samedi 7 novembre», Monat bleibt klein).
    const label = formatDayLabel(d, locale);
    return label.charAt(0).toUpperCase() + label.slice(1);
  };
  const partnerRate = (percent: number) => t("bookings.partnerRate", { percent });
  const [state, action] = useActionState(shared ? createGuestBookingAction : createBookingAction, null);
  const fetchSlots = shared ? fetchGuestSlotsAction : fetchSlotsAction;
  const factorFor = (rid: string) => resources.find((r) => r.id === rid)?.priceFactorPercent ?? 100;
  const optionsFor = (rid: string) => resources.find((r) => r.id === rid)?.durationOptions ?? settings.durationOptions;
  const maxFor = (rid: string) => {
    const r = resources.find((x) => x.id === rid);
    return r ? maxPersonsFor(r, settings) : 1;
  };
  const [sel, setSel] = useState(() => {
    const pre = prefill && resources.some((r) => r.id === prefill.resourceId) ? prefill : null;
    const resourceId = pre?.resourceId ?? resources[0]?.id ?? "";
    const opts = optionsFor(resourceId);
    const duration = pre && opts.some((o) => o.minutes === pre.duration) ? pre.duration : opts[0]?.minutes ?? 60;
    const persons = Math.min(Math.max(1, pre?.persons ?? 1), maxFor(resourceId));
    return { resourceId, duration, persons, date: pre?.date && pre.date >= today ? pre.date : today };
  });
  const [prefillNote, setPrefillNote] = useState<string | null>(null);
  const { resourceId, duration, date, persons } = sel;
  const resource = resources.find((r) => r.id === resourceId);
  const options = optionsFor(resourceId);
  const maxPersons = maxFor(resourceId);
  const option = options.find((o) => o.minutes === duration) ?? null;
  const factor = factorFor(resourceId);
  /** Anzeigepreis mit Partnertarif (gleiche Rundung wie auf dem Server). */
  const fp = (cents: number) => (factor === 100 ? cents : applyPriceFactorCents(cents, factor));
  const flatFrom = settings.personPricing && option?.flatFromPersons && option.flatPriceCents !== undefined && option.flatFromPersons <= maxPersons ? option.flatFromPersons : null;
  const [slots, setSlots] = useState<SlotDto[] | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [windowInfo, setWindowInfo] = useState<Pick<SlotsResult, "windowHint" | "outsideWindow" | "windowOverride"> | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [loading, start] = useTransition();
  const [paymentMethod, setPaymentMethod] = useState<"INVOICE" | "ONLINE">(settings.allowOnline ? "ONLINE" : "INVOICE");

  // Nur die Antwort der jeweils letzten Anfrage übernehmen (schnelles Blättern).
  const requestId = useRef(0);
  const load = (next: typeof sel) => {
    start(async () => {
      const id = ++requestId.current;
      const r = await fetchSlots(next.resourceId, next.date, next.duration, next.persons);
      if (id !== requestId.current) return;
      setSlots(r.slots);
      setSlotError(r.error ?? null);
      setWindowInfo(r);
      setTime((t) => (t && r.slots.some((x) => x.time === t && x.available) ? t : null));
    });
  };
  const update = (patch: Partial<typeof sel>) => {
    const next = { ...sel, ...patch };
    if (patch.resourceId) {
      const opts = optionsFor(patch.resourceId);
      if (!opts.some((o) => o.minutes === next.duration)) next.duration = opts[0]?.minutes ?? 60;
      next.persons = Math.min(next.persons, maxFor(patch.resourceId));
    }
    setSel(next);
    // Beim Ändern der Personenzahl bleibt die gewählte Zeit, falls sie weiterhin passt (siehe `selected`).
    if (patch.persons === undefined) setTime(null);
    setPrefillNote(null);
    load(next);
  };
  const setPersons = (n: number) => update({ persons: n });
  const setResourceId = (id: string) => update({ resourceId: id });
  const setDuration = (d: number) => update({ duration: d });
  const setDate = (d: string) => update({ date: d });

  // Erstes Laden nach dem Mounten (Zustand wird im Callback gesetzt).
  useEffect(() => {
    if (!sel.resourceId) return;
    let cancelled = false;
    const id = ++requestId.current;
    fetchSlots(sel.resourceId, sel.date, sel.duration, sel.persons).then((r) => {
      if (cancelled || id !== requestId.current) return;
      setSlots(r.slots);
      setSlotError(r.error ?? null);
      setWindowInfo(r);
      if (prefill && prefill.resourceId === sel.resourceId && prefill.date === sel.date) {
        const slot = r.slots.find((x) => x.time === prefill.time);
        if (slot?.available) {
          setTime(prefill.time);
          setPrefillNote(t("bookings.wizard.prefillFree", { time: prefill.time }));
        } else {
          setPrefillNote(slot?.reason ? t("bookings.wizard.prefillTakenReason", { time: prefill.time, reason: slotReasonLabel(slot.reason, t) }) : t("bookings.wizard.prefillTaken", { time: prefill.time }));
        }
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Während neue Zeiten (und Preise) geladen werden, gilt keine Auswahl: sonst stünde nach einer
  // Änderung der Personenzahl kurz der alte Preis da, und es könnte zu diesem Stand gebucht werden.
  const selected = loading ? null : slots?.find((s) => s.time === time && s.available) ?? null;
  const maxDate = shiftDate(today, settings.maxAdvanceDays);
  const payChoices = useMemo(() => {
    const c: Array<"INVOICE" | "ONLINE"> = [];
    if (settings.allowInvoice) c.push("INVOICE");
    if (settings.allowOnline && settings.onlineProvider !== "NONE") c.push("ONLINE");
    return c;
  }, [settings]);
  const needsPayment = (selected?.totalCents ?? 0) > 0;
  const showPersons = maxPersons > 1;
  const stepWhen = showPersons ? 4 : 3;
  const showRemaining = settings.capacityPerPerson && (resource?.capacity ?? 1) > 1;
  const tooFew = !!slots?.some((s) => s.reason === "Nicht genug Plätze frei");

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="resourceId" value={resourceId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time ?? ""} />
      <input type="hidden" name="durationMinutes" value={duration} />
      <input type="hidden" name="persons" value={persons} />
      {needsPayment && payChoices.length > 1 ? <input type="hidden" name="paymentMethod" value={paymentMethod} /> : null}

      {/* 1 Ressource */}
      <section className="animate-rise">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">{t("bookings.wizard.stepWhat")}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {resources.map((r) => (
            <button key={r.id} type="button" onClick={() => setResourceId(r.id)}
              className={cn("press text-left rounded-card border p-3.5 transition-colors", resourceId === r.id ? "border-ink bg-surface" : "border-line bg-surface hover:border-ink/30")}>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-ink-3" /><span className="font-medium">{r.name}</span></div>
              <div className="text-xs text-ink-3 mt-0.5">{resourceKindLabelT(r.kind, t)}{r.capacity > 1 ? ` · ${placesText(r.capacity, t)}` : ""}{r.description ? ` · ${r.description}` : ""}</div>
              {shared && (r.priceFactorPercent ?? 100) !== 100 ? <div className="text-xs text-ink-2 mt-0.5">{partnerRate(r.priceFactorPercent ?? 100)}</div> : null}
              {shared && r.shareNote ? <div className="text-xs text-ink-3 mt-0.5 italic">«{r.shareNote}»</div> : null}
            </button>
          ))}
        </div>
        {shared ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-control bg-surface-2 px-3 py-2 text-xs text-ink-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
            <span>{t("bookings.wizard.sharedInfo", { owner: shared.ownerName })}</span>
          </p>
        ) : null}
      </section>

      {/* 2 Dauer */}
      <section className="animate-rise [animation-delay:60ms]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">{t("bookings.wizard.stepDuration")}</h2>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button key={o.minutes} type="button" onClick={() => setDuration(o.minutes)}
              className={cn("press h-11 rounded-control px-4 text-sm font-medium border", duration === o.minutes ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2")}>
              {formatDuration(o.minutes, t)}<span className={cn("ml-2 text-xs", duration === o.minutes ? "text-bg/70" : "text-ink-3")}>{(() => { const c = fp(basePriceFor(o, persons, settings.personPricing).baseCents); return c ? formatMoney(c, settings.currency) : t("bookings.free"); })()}</span>
            </button>
          ))}
        </div>
        {settings.lastMinuteDiscountPercent > 0 ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ok"><Tag className="h-3.5 w-3.5" /> {t("bookings.wizard.lastMinute", { percent: settings.lastMinuteDiscountPercent, hours: settings.lastMinuteWindowHours })}</p>
        ) : null}
      </section>

      {/* 3 Personen (nur wenn mehrere möglich) */}
      {showPersons ? (
        <section className="animate-rise [animation-delay:90ms]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">{t("bookings.wizard.stepPersons")}</h2>
          <Card className="p-3 space-y-2">
            <PersonsStepper value={persons} max={maxPersons} onChange={setPersons} locale={locale} />
            {settings.personPricing && option ? (
              <p className="text-center text-xs text-ink-3">
                {(() => {
                  const bp = basePriceFor(option, persons, true);
                  const forPersons = (cents: number) => t("bookings.wizard.priceFor", { price: formatMoney(cents, settings.currency), persons: personsText(persons, t) });
                  if (factor !== 100) return `${forPersons(fp(bp.baseCents))} · ${partnerRate(factor)}`;
                  if (bp.isFlatRate) return t("bookings.wizard.flatPrice", { price: formatMoney(bp.baseCents, settings.currency) });
                  if (bp.perPersonCents !== null) return `${persons} × ${formatMoney(bp.perPersonCents, settings.currency)} = ${formatMoney(bp.baseCents, settings.currency)}`;
                  return forPersons(bp.baseCents);
                })()}
              </p>
            ) : null}
            {flatFrom ? (
              <p className={cn("flex items-start gap-1.5 rounded-control px-3 py-2 text-xs", persons >= flatFrom ? "bg-accent-soft text-ink" : "bg-surface-2 text-ink-2")}>
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
                <span>{settings.flatExclusive
                  ? t("bookings.wizard.flatFromWhole", { from: flatFrom, whole: wholeResourceLabelT(resource?.kind ?? "OTHER", t), price: formatMoney(fp(option!.flatPriceCents!), settings.currency) })
                  : t("bookings.wizard.flatFrom", { from: flatFrom, price: formatMoney(fp(option!.flatPriceCents!), settings.currency) })}</span>
              </p>
            ) : null}
          </Card>
        </section>
      ) : null}

      {/* Datum + Zeit */}
      <section className="animate-rise [animation-delay:120ms]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">{t("bookings.wizard.stepWhen", { n: stepWhen })}</h2>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <button type="button" aria-label={t("bookings.wizard.prevDay")} onClick={() => setDate(shiftDate(date, -1))} disabled={date <= today} className="press h-11 w-11 rounded-full hover:bg-surface-2 disabled:opacity-30 flex items-center justify-center"><ChevronLeft className="h-5 w-5" /></button>
            <div className="flex-1 text-center">
              <div className="font-semibold">{weekdayLabel(date)}</div>
              <input type="date" aria-label={t("bookings.wizard.pickDate")} value={date} min={today} max={maxDate} onChange={(e) => e.target.value && setDate(e.target.value)} className="text-xs text-ink-3 bg-transparent text-center" />
            </div>
            <button type="button" aria-label={t("bookings.wizard.nextDay")} onClick={() => setDate(shiftDate(date, 1))} disabled={date >= maxDate} className="press h-11 w-11 rounded-full hover:bg-surface-2 disabled:opacity-30 flex items-center justify-center"><ChevronRight className="h-5 w-5" /></button>
          </div>
          <div className="flex gap-1.5 justify-center mt-2 py-1">
            {[0, 1, 2].map((d) => { const ds = shiftDate(today, d); return <button key={d} type="button" aria-pressed={date === ds} disabled={ds > maxDate} onClick={() => setDate(ds)} className={cn("relative h-7 rounded-full px-3 text-xs font-medium disabled:opacity-30 after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']", date === ds ? "bg-ink text-bg" : "bg-surface-2 text-ink-2")}>{t(d === 0 ? "bookings.wizard.today" : d === 1 ? "bookings.wizard.tomorrow" : "bookings.wizard.dayAfter")}</button>; })}
          </div>
          {prefillNote ? <p className="mt-2 rounded-control bg-surface-2 px-3 py-2 text-xs text-ink-2">{prefillNote}</p> : null}
          <div className="mt-3 min-h-16">
            {loading || (slots === null && resourceId) ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-3"><Spinner /> {t("bookings.wizard.loading")}</div>
            ) : slotError ? (
              <p className="py-6 text-center text-sm text-accent">{slotErrorLabel(slotError, t, maxPersons)}</p>
            ) : !slots || slots.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-3">{t("bookings.wizard.closed")}</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {slots.map((s) => (
                  <button key={s.time} type="button" disabled={!s.available} onClick={() => setTime(s.time)} title={s.reason ? slotReasonLabel(s.reason, t) : undefined}
                    aria-label={`${t("bookings.wizard.timeAt", { time: s.time })}${s.available ? (showRemaining ? `, ${t("bookings.wizard.remaining", { count: s.remaining })}` : "") : `, ${slotReasonLabel(s.reason, t)}`}`}
                    className={cn("press min-h-11 rounded-control text-sm font-medium tabular-nums border transition-colors flex flex-col items-center justify-center leading-tight",
                      time === s.time ? "bg-ink text-bg border-ink" : s.available ? "bg-surface border-line hover:border-ink/40" : "bg-surface-2 border-transparent text-ink-3/60 cursor-not-allowed")}>
                    <span className={cn(!s.available && "line-through")}>{s.time}</span>
                    {showRemaining && s.available ? <span className={cn("text-[10px] font-normal", time === s.time ? "text-bg/70" : "text-ink-3")}>{t("bookings.wizard.remaining", { count: s.remaining })}</span> : null}
                  </button>
                ))}
              </div>
            )}
            {tooFew ? <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3"><Users className="h-3.5 w-3.5" aria-hidden /> {flatFrom && persons >= flatFrom && settings.flatExclusive
                ? t("bookings.wizard.tooFewFlat", { persons: personsText(persons, t), whole: wholeResourceLabelT(resource?.kind ?? "OTHER", t) })
                : t("bookings.wizard.tooFew", { persons: personsText(persons, t) })}</p> : null}
            {!loading && !slotError && windowInfo?.windowHint ? (
              <p className="mt-2 rounded-control bg-surface-2 px-3 py-2 text-xs text-ink-2">
                {windowHintLabel(windowInfo.windowHint, locale, t)}.
                {windowInfo.windowOverride ? ` ${t("bookings.wizard.windowOverride")}` : windowInfo.outsideWindow ? ` ${t("bookings.wizard.windowOutside")}` : ""}
              </p>
            ) : null}
          </div>
        </Card>
      </section>

      {/* Zusammenfassung */}
      <section className={cn("animate-rise [animation-delay:180ms]", !selected && "opacity-50 pointer-events-none")}>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">{t("bookings.wizard.stepConfirm", { n: stepWhen + 1 })}</h2>
        <Card className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">{resource?.name}</div>
              <div className="text-sm text-ink-3 inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {weekdayLabel(date)}, {time ? t("bookings.wizard.timeAt", { time }) : "–"} · {formatDuration(duration, t)}</div>
              {showPersons || selected?.unitLabel ? (
                <div className="text-sm text-ink-3 inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {personsText(persons, t)}{selected?.isFlatRate ? ` · ${t("bookings.wizard.flat")}` : ""}</div>
              ) : null}
            </div>
            <div className="text-right">
              {selected && selected.discountCents > 0 ? <div className="text-xs text-ink-3 line-through tabular-nums">{formatMoney(selected.basePriceCents, settings.currency)}</div> : null}
              <div className="text-xl font-semibold tabular-nums">{selected ? (selected.totalCents ? formatMoney(selected.totalCents, settings.currency) : t("bookings.free")) : "–"}</div>
              {selected?.detail ? <div className="text-xs text-ink-3 tabular-nums">{selected.detail}</div> : null}
              {selected?.discountReason ? <div className="text-xs text-ok">{discountReasonLabel(selected.discountReason, t)}</div> : null}
            </div>
          </div>
          {needsPayment && payChoices.length > 1 ? (
            <div className="grid grid-cols-2 gap-2">
              {payChoices.map((c) => (
                <button key={c} type="button" onClick={() => setPaymentMethod(c)}
                  className={cn("press h-12 rounded-control border text-sm font-medium inline-flex items-center justify-center gap-2", paymentMethod === c ? "bg-ink text-bg border-ink" : "bg-surface border-line")}>
                  {c === "ONLINE" ? <><CreditCard className="h-4 w-4" /> {t("bookings.wizard.payOnline")}</> : <><FileText className="h-4 w-4" /> {t("bookings.wizard.payInvoice")}</>}
                </button>
              ))}
            </div>
          ) : needsPayment && payChoices.length === 1 ? (
            <p className="text-sm text-ink-3">{payChoices[0] === "ONLINE" ? t("bookings.wizard.onlineAfter") : shared ? t("bookings.wizard.invoiceFrom", { owner: shared.ownerName }) : t("bookings.wizard.invoice")}</p>
          ) : null}
          <Field label={t("bookings.wizard.note")}><Input name="note" placeholder={t("bookings.wizard.notePlaceholder")} maxLength={191} /></Field>
          <p className="text-xs text-ink-3">
            {settings.approvalRequired ? t("bookings.wizard.approvalInfo") : t("bookings.wizard.instantInfo")}
            {settings.cancellationHours > 0 ? ` ${t("bookings.wizard.freeCancel", { hours: settings.cancellationHours })}` : ""}
          </p>
        </Card>
      </section>

      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <div className="sticky bottom-24 md:bottom-4">
        <SubmitButton size="lg" className="w-full shadow-lg" disabled={!selected} pendingText={t("bookings.wizard.submitting")}>
          {t(selected && needsPayment && (payChoices.length === 1 ? payChoices[0] : paymentMethod) === "ONLINE" && !settings.approvalRequired ? "bookings.wizard.submitPay" : settings.approvalRequired ? "bookings.wizard.submitRequest" : "bookings.wizard.submit")}
        </SubmitButton>
      </div>
    </form>
  );
}
