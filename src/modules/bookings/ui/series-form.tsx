"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { AlertTriangle, CalendarCheck2, CheckCircle2, Repeat } from "lucide-react";
import { createSeriesAction, previewSeriesAction, type SeriesPreview } from "@/modules/bookings/series-actions";
import { ISO_WEEKDAYS } from "@/modules/bookings/series";
import { formatDateL, formatTimeRangeL, seriesConflictLabel, seriesErrorLabel, seriesSummaryLabel, weekdaysLabelL } from "@/modules/bookings/i18n";
import { useLocale, useT } from "@/components/locale";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton, Spinner } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type ResourceDto = { id: string; name: string; maxPersons: number };


/**
 * Serienbuchung erfassen: Wochentage, Zeitraum, Zeit. «Termine prüfen» zeigt alle Termine mit
 * Konflikten (diese werden übersprungen), danach legt «Serie anlegen» die buchbaren Termine an.
 */
export function SeriesForm({ resources, today, defaultUntil }: { resources: ResourceDto[]; today: string; defaultUntil: string }) {
  const t = useT();
  const locale = useLocale();
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
        setPreviewError(t("bookings.common.failed"));
      }
    });
  };

  return (
    <form ref={formRef} action={action} onChange={invalidate} className="space-y-4">
      {weekdays.map((d) => <input key={d} type="hidden" name="weekdays" value={d} />)}
      <Card className="animate-rise p-4 space-y-4">
        <Field label={t("bookings.series.f.resource")}>
          <Select name="resourceId" value={resourceId} onChange={(e) => { setResourceId(e.target.value); invalidate(); }} required>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <div>
          <span className="block text-sm font-medium text-ink-2 mb-1.5">{t("bookings.series.f.weekdays")}</span>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={t("bookings.series.f.weekdays")}>
            {ISO_WEEKDAYS.map((d) => (
              <button key={d} type="button" aria-pressed={weekdays.includes(d)} aria-label={weekdaysLabelL([d], locale, true)} onClick={() => toggleDay(d)}
                className={cn("press h-11 rounded-control border text-sm font-medium", weekdays.includes(d) ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2")}>
                {weekdaysLabelL([d], locale)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("bookings.series.f.from")}><Input type="date" name="fromDate" defaultValue={today} min={today} required /></Field>
          <Field label={t("bookings.series.f.until")}><Input type="date" name="untilDate" defaultValue={defaultUntil} min={today} required /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("bookings.series.f.start")}><Input type="time" name="startTime" defaultValue="18:00" step={300} required /></Field>
          <Field label={t("bookings.series.f.end")}><Input type="time" name="endTime" defaultValue="20:00" step={300} required /></Field>
          <Field label={t("bookings.detail.persons")}><Input type="number" name="persons" defaultValue={1} min={1} max={max} inputMode="numeric" required /></Field>
        </div>
        <Field label={t("bookings.wizard.note")}><Input name="note" maxLength={191} placeholder={t("bookings.series.f.notePh")} /></Field>
      </Card>

      <Button type="button" variant="secondary" size="lg" className="w-full" disabled={checking || weekdays.length === 0} onClick={check}>
        {checking ? <Spinner /> : <CalendarCheck2 className="h-5 w-5" />} {t("bookings.series.f.check")}
      </Button>
      {weekdays.length === 0 ? <p className="-mt-2 text-center text-xs text-ink-3">{t("bookings.series.pickWeekday")}</p> : null}
      {previewError ? <Alert>{seriesErrorLabel(previewError, t)}</Alert> : null}

      {preview ? (
        <section className="animate-rise space-y-3" aria-live="polite">
          <Alert tone={preview.items.some((i) => i.conflict) ? "warn" : "ok"} icon={preview.items.some((i) => i.conflict) ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}>
            {preview.resourceName}: {seriesSummaryLabel(preview.freeCount, preview.items.map((i) => i.conflict), t)}.{preview.items.some((i) => i.conflict) ? ` ${t("bookings.series.f.skipHint")}` : ""}
          </Alert>
          <Card className="divide-y divide-line overflow-hidden max-h-[24rem] overflow-y-auto">
            {preview.items.map((o) => (
              <div key={o.date} className={cn("flex items-center gap-3 px-4 py-2.5 text-sm min-h-11", o.conflict && "text-ink-3")}>
                <span className={cn("flex-1 tabular-nums", o.conflict && "line-through")}>{formatDateL(new Date(o.startsAt), locale)}</span>
                <span className="tabular-nums">{formatTimeRangeL(new Date(o.startsAt), new Date(o.endsAt), locale)}</span>
                {o.conflict ? <Badge tone="warn">{seriesConflictLabel(o.conflict, t)}</Badge> : <Badge tone="ok">{t("bookings.series.f.free")}</Badge>}
              </div>
            ))}
          </Card>
          {state && !state.ok ? <Alert>{seriesErrorLabel(state.error, t)}</Alert> : null}
          <div className="sticky bottom-24 md:bottom-4">
            <SubmitButton size="lg" className="w-full shadow-lg" disabled={preview.freeCount === 0} pendingText={t("bookings.series.f.creating")}>
              <Repeat className="h-5 w-5" /> {t(preview.freeCount === 1 ? "bookings.series.f.create.one" : "bookings.series.f.create.other", { n: preview.freeCount })}
            </SubmitButton>
          </div>
        </section>
      ) : state && !state.ok ? <Alert>{seriesErrorLabel(state.error, t)}</Alert> : null}
    </form>
  );
}
