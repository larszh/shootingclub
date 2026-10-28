"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Banknote, Check, ChevronLeft, ChevronRight, FileText, Gift, Info, Search } from "lucide-react";
import { adminCreateBookingAction } from "@/modules/bookings/actions";
import { fetchAdminSlotsAction, type SlotDto } from "@/modules/bookings/slot-actions";
import { formatDuration, type DurationOption } from "@/modules/bookings/types";
import { basePriceFor, maxPersonsFor, wholeResourceLabel } from "@/modules/bookings/pricing";
import { PersonsStepper } from "./persons-stepper";
import { Avatar } from "@/components/avatar";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton, Spinner } from "@/components/ui/form";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type MemberDto = { userId: string; name: string; email: string; avatarUrl: string | null; memberNumber: string | null };
type ResourceDto = { id: string; name: string; kind: string; capacity: number; maxPersons: number | null; durationOptions: DurationOption[] | null };
type PersonSettings = { personPricing: boolean; maxPersons: number; flatExclusive: boolean; capacityPerPerson: boolean };
type Payment = "INVOICE" | "CASH" | "FREE";

function shiftDate(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function weekdayLabel(dateStr: string) {
  return new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${dateStr}T12:00:00Z`));
}

const PAYMENTS: Array<{ key: Payment; label: string; hint: string; icon: React.ReactNode }> = [
  { key: "INVOICE", label: "Rechnung", hint: "mit QR-Zahlteil", icon: <FileText className="h-4 w-4" /> },
  { key: "CASH", label: "Bar / vor Ort", hint: "gilt als bezahlt", icon: <Banknote className="h-4 w-4" /> },
  { key: "FREE", label: "Gratis", hint: "ohne Bezahlung", icon: <Gift className="h-4 w-4" /> },
];

export function AdminBookingForm({ members, resources, durationOptions, currency, today, initial, personSettings }: {
  members: MemberDto[]; resources: ResourceDto[]; durationOptions: DurationOption[]; currency: string; today: string;
  initial: { resourceId?: string; date?: string; userId?: string; duration?: number; time?: string; persons?: number };
  personSettings: PersonSettings;
}) {
  const [state, action] = useActionState(adminCreateBookingAction, null);
  const optionsFor = (rid: string) => resources.find((r) => r.id === rid)?.durationOptions ?? durationOptions;
  const maxFor = (rid: string) => {
    const r = resources.find((x) => x.id === rid);
    return r ? maxPersonsFor(r, personSettings) : 1;
  };
  const firstResource = resources.find((r) => r.id === initial.resourceId)?.id ?? resources[0]?.id ?? "";
  const [sel, setSel] = useState(() => {
    const opts = optionsFor(firstResource);
    const duration = opts.some((o) => o.minutes === initial.duration) ? initial.duration! : opts[0]?.minutes ?? 60;
    const persons = Math.min(Math.max(1, initial.persons ?? 1), maxFor(firstResource));
    return { resourceId: firstResource, duration, persons, date: initial.date ?? today };
  });
  const [userId, setUserId] = useState(members.some((m) => m.userId === initial.userId) ? initial.userId! : "");
  const [query, setQuery] = useState("");
  const [slots, setSlots] = useState<SlotDto[] | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(initial.time ?? null);
  const [payment, setPayment] = useState<Payment>("INVOICE");
  const [loading, start] = useTransition();

  // Nur die Antwort der jeweils letzten Anfrage übernehmen (schnelles Blättern).
  const requestId = useRef(0);
  const load = (next: typeof sel) => start(async () => {
    const id = ++requestId.current;
    const r = await fetchAdminSlotsAction(next.resourceId, next.date, next.duration, next.persons);
    if (id !== requestId.current) return;
    setSlots(r.slots);
    setSlotError(r.error ?? null);
    setTime((t) => (t && r.slots.some((x) => x.time === t && x.available) ? t : null));
  });
  const update = (patch: Partial<typeof sel>) => {
    const next = { ...sel, ...patch };
    if (patch.resourceId) {
      const opts = optionsFor(patch.resourceId);
      if (!opts.some((o) => o.minutes === next.duration)) next.duration = opts[0]?.minutes ?? 60;
      next.persons = Math.min(next.persons, maxFor(patch.resourceId));
    }
    setSel(next);
    if (patch.persons === undefined) setTime(null);
    load(next);
  };

  useEffect(() => {
    if (!sel.resourceId) return;
    let cancelled = false;
    const id = ++requestId.current;
    fetchAdminSlotsAction(sel.resourceId, sel.date, sel.duration, sel.persons).then((r) => {
      if (cancelled || id !== requestId.current) return;
      setSlots(r.slots);
      setSlotError(r.error ?? null);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? members.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.memberNumber ?? "").toLowerCase().includes(q)) : members;
    return list.slice(0, 8);
  }, [members, query]);
  const member = members.find((m) => m.userId === userId) ?? null;
  // Während neue Zeiten (und Preise) geladen werden, gilt keine Auswahl (kein veralteter Preis).
  const selected = loading ? null : slots?.find((s) => s.time === time && s.available) ?? null;
  const options = optionsFor(sel.resourceId);
  const price = selected ? (payment === "FREE" ? 0 : selected.totalCents) : null;
  const resource = resources.find((r) => r.id === sel.resourceId);
  const maxPersons = maxFor(sel.resourceId);
  const option = options.find((o) => o.minutes === sel.duration) ?? null;
  const flatFrom = personSettings.personPricing && option?.flatFromPersons && option.flatPriceCents !== undefined && option.flatFromPersons <= maxPersons ? option.flatFromPersons : null;
  const showRemaining = personSettings.capacityPerPerson && (resource?.capacity ?? 1) > 1;
  const tooFew = !!slots?.some((s) => s.reason === "Nicht genug Plätze frei");

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="resourceId" value={sel.resourceId} />
      <input type="hidden" name="date" value={sel.date} />
      <input type="hidden" name="time" value={time ?? ""} />
      <input type="hidden" name="durationMinutes" value={sel.duration} />
      <input type="hidden" name="persons" value={sel.persons} />
      <input type="hidden" name="payment" value={payment} />

      <section className="animate-rise">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">1 · Für wen</h2>
        {member ? (
          <Card className="p-3 flex items-center gap-3">
            <Avatar name={member.name} src={member.avatarUrl} size={44} />
            <div className="min-w-0 flex-1"><div className="font-medium truncate">{member.name}</div><div className="text-xs text-ink-3 truncate">{member.email}{member.memberNumber ? ` · Nr. ${member.memberNumber}` : ""}</div></div>
            <button type="button" onClick={() => setUserId("")} className="press h-10 rounded-control px-3 text-sm font-medium border border-line">Ändern</button>
          </Card>
        ) : (
          <Card className="p-3 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, E-Mail oder Mitgliedernummer" className="pl-9" aria-label="Mitglied suchen" />
            </div>
            <div className="divide-y divide-line">
              {filtered.map((m) => (
                <button key={m.userId} type="button" onClick={() => setUserId(m.userId)} className="press flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-2 rounded-control px-1">
                  <Avatar name={m.name} src={m.avatarUrl} size={36} tone="soft" />
                  <span className="min-w-0 flex-1"><span className="block font-medium truncate">{m.name}</span><span className="block text-xs text-ink-3 truncate">{m.email}</span></span>
                </button>
              ))}
              {filtered.length === 0 ? <p className="py-3 text-sm text-ink-3">Kein Mitglied gefunden.</p> : null}
            </div>
          </Card>
        )}
      </section>

      <section className="animate-rise [animation-delay:60ms]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">2 · Was und wie lange</h2>
        <div className="flex flex-wrap gap-2">
          {resources.map((r) => (
            <button key={r.id} type="button" onClick={() => update({ resourceId: r.id })}
              className={cn("press h-11 rounded-control px-4 text-sm font-medium border", sel.resourceId === r.id ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2")}>{r.name}</button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((o) => (
            <button key={o.minutes} type="button" onClick={() => update({ duration: o.minutes })}
              className={cn("press h-10 rounded-full px-3.5 text-sm font-medium border", sel.duration === o.minutes ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2")}>
              {formatDuration(o.minutes)}<span className={cn("ml-1.5 text-xs", sel.duration === o.minutes ? "text-bg/70" : "text-ink-3")}>{(() => { const c = basePriceFor(o, sel.persons, personSettings.personPricing).baseCents; return c ? formatMoney(c, currency) : "gratis"; })()}</span>
            </button>
          ))}
        </div>
        {maxPersons > 1 ? (
          <Card className="mt-2 p-3 space-y-2">
            <PersonsStepper value={sel.persons} max={maxPersons} onChange={(n) => update({ persons: n })} />
            {flatFrom ? (
              <p className={cn("flex items-start gap-1.5 rounded-control px-3 py-2 text-xs", sel.persons >= flatFrom ? "bg-accent-soft text-ink" : "bg-surface-2 text-ink-2")}>
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
                <span>Ab {flatFrom} Personen gilt der Pauschalpreis{personSettings.flatExclusive ? ` für ${wholeResourceLabel(resource?.kind ?? "OTHER")}` : ""} ({formatMoney(option!.flatPriceCents!, currency)}).</span>
              </p>
            ) : null}
          </Card>
        ) : null}
      </section>

      <section className="animate-rise [animation-delay:120ms]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">3 · Wann</h2>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => update({ date: shiftDate(sel.date, -1) })} className="press h-11 w-11 rounded-full hover:bg-surface-2 flex items-center justify-center" aria-label="Vorheriger Tag"><ChevronLeft className="h-5 w-5" /></button>
            <div className="flex-1 text-center">
              <div className="font-semibold capitalize">{weekdayLabel(sel.date)}</div>
              <input type="date" value={sel.date} onChange={(e) => e.target.value && update({ date: e.target.value })} className="text-xs text-ink-3 bg-transparent text-center" aria-label="Datum" />
            </div>
            <button type="button" onClick={() => update({ date: shiftDate(sel.date, 1) })} className="press h-11 w-11 rounded-full hover:bg-surface-2 flex items-center justify-center" aria-label="Nächster Tag"><ChevronRight className="h-5 w-5" /></button>
          </div>
          {sel.date !== today ? <div className="mt-1 flex justify-center"><button type="button" onClick={() => update({ date: today })} className="h-7 rounded-full px-3 text-xs font-medium bg-surface-2 text-ink-2">Heute</button></div> : null}
          <div className="mt-3 min-h-16">
            {loading || (slots === null && sel.resourceId) ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-3"><Spinner /> Verfügbarkeit wird geladen…</div>
            ) : slotError ? (
              <p className="py-6 text-center text-sm text-accent">{slotError}</p>
            ) : !slots || slots.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-3">An diesem Tag geschlossen.</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {slots.map((s) => (
                  <button key={s.time} type="button" disabled={!s.available} onClick={() => setTime(s.time)} title={s.reason}
                    aria-label={`${s.time} Uhr${s.available ? (showRemaining ? `, ${s.remaining} frei` : "") : `, ${s.reason ?? "nicht verfügbar"}`}`}
                    className={cn("press min-h-11 rounded-control text-sm font-medium tabular-nums border transition-colors flex flex-col items-center justify-center leading-tight",
                      time === s.time ? "bg-ink text-bg border-ink" : s.available ? "bg-surface border-line hover:border-ink/40" : "bg-surface-2 border-transparent text-ink-3/60 cursor-not-allowed")}>
                    <span className={cn(!s.available && "line-through")}>{s.time}</span>
                    {showRemaining && s.available ? <span className={cn("text-[10px] font-normal", time === s.time ? "text-bg/70" : "text-ink-3")}>{s.remaining} frei</span> : null}
                  </button>
                ))}
              </div>
            )}
            {tooFew ? <p className="mt-2 text-xs text-ink-3">Durchgestrichene Zeiten: Nicht genug Plätze frei für {sel.persons === 1 ? "1 Person" : `${sel.persons} Personen`}.</p> : null}
          </div>
          <p className="mt-2 text-xs text-ink-3">Als Verwaltung gelten Vorlauf und Vorausbuchung nicht. Öffnungszeiten, Sperrzeiten und Plätze werden beachtet.</p>
        </Card>
      </section>

      <section className={cn("animate-rise [animation-delay:180ms]", !selected && "opacity-50")}>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">4 · Bezahlung</h2>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENTS.map((p) => (
            <button key={p.key} type="button" onClick={() => setPayment(p.key)}
              className={cn("press rounded-control border p-2.5 text-left min-h-16", payment === p.key ? "bg-ink text-bg border-ink" : "bg-surface border-line")}>
              <span className="flex items-center gap-1.5 text-sm font-medium">{p.icon} {p.label}</span>
              <span className={cn("block text-xs mt-0.5", payment === p.key ? "text-bg/70" : "text-ink-3")}>{p.hint}</span>
            </button>
          ))}
        </div>
        <Card className="mt-2 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-ink-3">Preis</span>
            <span className="text-lg font-semibold tabular-nums">
              {price === null ? "–" : price ? formatMoney(price, currency) : "gratis"}
              {selected?.discountReason && payment !== "FREE" ? <span className="ml-2 text-xs font-normal text-ok">{selected.discountReason}</span> : null}
            </span>
          </div>
          {selected?.unitLabel ? <div className="flex items-center justify-between gap-3 text-xs text-ink-3"><span>{selected.unitLabel}</span>{selected.detail ? <span className="tabular-nums">{selected.detail}</span> : null}</div> : null}
          <Field label="Bemerkung (optional)"><Input name="note" placeholder="z.B. Telefonisch reserviert" maxLength={191} /></Field>
        </Card>
      </section>

      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <div className="sticky bottom-24 md:bottom-4">
        <SubmitButton size="lg" className="w-full shadow-lg" disabled={!selected || !userId} pendingText="Wird gebucht…">
          <Check className="h-5 w-5" /> {!userId ? "Mitglied wählen" : !selected ? (loading ? "Wird geladen…" : "Zeit wählen") : `Für ${member?.name.split(" ")[0] ?? "Mitglied"} buchen`}
        </SubmitButton>
      </div>
    </form>
  );
}
