"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { AlertTriangle, CalendarCheck2, CheckCircle2, Repeat } from "lucide-react";
import { createSeriesAction, previewSeriesAction, type SeriesPreview } from "@/modules/bookings/series-actions";
import { CONFLICT_LABEL, ISO_WEEKDAYS, ISO_WEEKDAY_SHORT, ISO_WEEKDAY_LONG } from "@/modules/bookings/series";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton, Spinner } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type ResourceDto = { id: string; name: string; maxPersons: number };

const DATE_FMT = new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Zurich" });
const TIME_FMT = new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });

/**
 * Serienbuchung erfassen: Wochentage, Zeitraum, Zeit. «Termine prüfen» zeigt alle Termine mit
 * Konflikten (diese werden übersprungen), danach legt «Serie anlegen» die buchbaren Termine an.
 */
export function SeriesForm({ resources, today, defaultUntil }: { resources: ResourceDto[]; today: string; defaultUntil: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(createSeriesAction, null);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [resourceId, setResourceId] = useState(resources[0]?.id ?? "");
  const [preview, setPreview] = useState<SeriesPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [checking, start] = useTransition();
  const max = resources.find((r) => r.id === resourceId)?.maxPersons ?? 1;

  // Jede Änderung macht die Vorschau ungültig.
  const invalidate = () => { setPreview(null); setPreviewError(null); };
  const toggleDay = (d: number) => { setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort())); invalidate(); };

  const check = () => {
    const form = formRef.current;
    if (!form) return;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    start(async () => {
      try {
        const r = await previewSeriesAction(fd);
        if (!r.ok) { setPreview(null); setPreviewError(r.error); return; }
        setPreview(r.data ?? null);
        setPreviewError(null);
      } catch {
        setPreviewError("Das hat nicht geklappt. Bitte nochmals versuchen.");
      }
    });
  };

  return (
    <form ref={formRef} action={action} onChange={invalidate} className="space-y-4">
      {weekdays.map((d) => <input key={d} type="hidden" name="weekdays" value={d} />)}
      <Card className="animate-rise p-4 space-y-4">
        <Field label="Ressource">
          <Select name="resourceId" value={resourceId} onChange={(e) => { setResourceId(e.target.value); invalidate(); }} required>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <div>
          <span className="block text-sm font-medium text-ink-2 mb-1.5">Wochentage</span>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Wochentage">
            {ISO_WEEKDAYS.map((d) => (
              <button key={d} type="button" aria-pressed={weekdays.includes(d)} aria-label={ISO_WEEKDAY_LONG[d]} onClick={() => toggleDay(d)}
                className={cn("press h-11 rounded-control border text-sm font-medium", weekdays.includes(d) ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2")}>
                {ISO_WEEKDAY_SHORT[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Von"><Input type="date" name="fromDate" defaultValue={today} min={today} required /></Field>
          <Field label="Bis und mit"><Input type="date" name="untilDate" defaultValue={defaultUntil} min={today} required /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Beginn"><Input type="time" name="startTime" defaultValue="18:00" step={300} required /></Field>
          <Field label="Ende"><Input type="time" name="endTime" defaultValue="20:00" step={300} required /></Field>
          <Field label="Personen"><Input type="number" name="persons" defaultValue={1} min={1} max={max} inputMode="numeric" required /></Field>
        </div>
        <Field label="Bemerkung (optional)"><Input name="note" maxLength={191} placeholder="z.B. Training Jungschützen" /></Field>
      </Card>

      <Button type="button" variant="secondary" size="lg" className="w-full" disabled={checking || weekdays.length === 0} onClick={check}>
        {checking ? <Spinner /> : <CalendarCheck2 className="h-5 w-5" />} Termine prüfen
      </Button>
      {weekdays.length === 0 ? <p className="-mt-2 text-center text-xs text-ink-3">Bitte mindestens einen Wochentag wählen.</p> : null}
      {previewError ? <Alert>{previewError}</Alert> : null}

      {preview ? (
        <section className="animate-rise space-y-3" aria-live="polite">
          <Alert tone={preview.items.some((i) => i.conflict) ? "warn" : "ok"} icon={preview.items.some((i) => i.conflict) ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}>
            {preview.resourceName}: {preview.summary}.{preview.items.some((i) => i.conflict) ? " Termine mit Konflikt werden übersprungen." : ""}
          </Alert>
          <Card className="divide-y divide-line overflow-hidden max-h-[24rem] overflow-y-auto">
            {preview.items.map((o) => (
              <div key={o.date} className={cn("flex items-center gap-3 px-4 py-2.5 text-sm min-h-11", o.conflict && "text-ink-3")}>
                <span className={cn("flex-1 tabular-nums", o.conflict && "line-through")}>{DATE_FMT.format(new Date(o.startsAt))}</span>
                <span className="tabular-nums">{TIME_FMT.format(new Date(o.startsAt))}–{TIME_FMT.format(new Date(o.endsAt))}</span>
                {o.conflict ? <Badge tone="warn">{CONFLICT_LABEL[o.conflict]}</Badge> : <Badge tone="ok">frei</Badge>}
              </div>
            ))}
          </Card>
          {state && !state.ok ? <Alert>{state.error}</Alert> : null}
          <div className="sticky bottom-24 md:bottom-4">
            <SubmitButton size="lg" className="w-full shadow-lg" disabled={preview.freeCount === 0} pendingText="Wird angelegt…">
              <Repeat className="h-5 w-5" /> {preview.freeCount === 1 ? "Serie anlegen (1 Termin)" : `Serie anlegen (${preview.freeCount} Termine)`}
            </SubmitButton>
          </div>
        </section>
      ) : state && !state.ok ? <Alert>{state.error}</Alert> : null}
    </form>
  );
}
