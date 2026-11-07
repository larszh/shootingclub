"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Alert, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { saveShiftAction } from "@/modules/shifts/actions";
import { QUALIFICATION_KINDS, qualificationLabel } from "@/modules/qualifications/types";
import { isEventKind } from "@/modules/events/types";
import { kindLabel } from "@/modules/events/ui/i18n";
import { useLocale, useT } from "@/components/locale";

export type ShiftEventChoice = { id: string; title: string; kind: string; day: string; time: string | null; endTime: string | null; label: string };

export type ShiftFormValues = {
  id?: string; title: string; eventId: string | null; date: string; startTime: string; endTime: string; capacity: number;
  requiredQualification: string | null; hoursCredit: number | null; note: string | null;
};

/** Einsatz erfassen/bearbeiten. Mit Anlass: Datum und Zeit werden vom Anlass vorgeschlagen. Ohne Anlass: z.B. Standdienst. */
export function ShiftForm({ initial, events, defaultDate }: { initial?: ShiftFormValues; events: ShiftEventChoice[]; defaultDate: string }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [state, action, pending] = useActionState(saveShiftAction, null);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  const [eventId, setEventId] = useState(initial?.eventId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(initial?.startTime ?? "08:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "12:00");

  useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? t("adm2.common.saved"));
    if (state.data?.id && !initial?.id) router.push(`/admin/shifts/${state.data.id}`);
    else router.refresh();
  }, [state, router, initial?.id, t]);

  function pickEvent(id: string) {
    setEventId(id);
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    setDate(ev.day);
    if (ev.time) setStartTime(ev.time);
    if (ev.endTime) setEndTime(ev.endTime);
    if (!title.trim()) setTitle(ev.kind === "WORK" ? t("adm2.shifts.form.workTitle") : t("adm2.shifts.form.helperTitle"));
  }

  const groups = new Map<string, ShiftEventChoice[]>();
  for (const e of events) {
    const k = isEventKind(e.kind) ? kindLabel(e.kind, locale, true) : t("adm2.shifts.form.other");
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Card className="animate-rise space-y-3 p-4">
        <Field label={t("adm2.shifts.form.event")} hint={t("adm2.shifts.form.eventHint")} error={err?.eventId}>
          <Select name="eventId" value={eventId} onChange={(e) => pickEvent(e.target.value)}>
            <option value="">{t("adm2.shifts.form.noEvent")}</option>
            {[...groups].map(([label, list]) => (
              <optgroup key={label} label={label}>
                {list.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label={t("adm2.shifts.form.title")} error={err?.title}>
          <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={191} placeholder={t("adm2.shifts.form.titlePh")} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t("adm2.common.date")} error={err?.date}><Input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
          <Field label={t("adm2.common.from")} error={err?.startTime}><Input type="time" name="startTime" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></Field>
          <Field label={t("adm2.common.to")} hint={t("adm2.shifts.form.toHint")} error={err?.endTime}><Input type="time" name="endTime" value={endTime} onChange={(e) => setEndTime(e.target.value)} required /></Field>
        </div>
      </Card>
      <Card className="animate-rise space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("adm2.shifts.form.capacity")} error={err?.capacity}><Input name="capacity" inputMode="numeric" defaultValue={initial?.capacity ?? 2} required /></Field>
          <Field label={t("adm2.shifts.form.credit")} hint={t("adm2.shifts.form.creditHint")} error={err?.hoursCredit}>
            <Input name="hoursCredit" inputMode="decimal" defaultValue={initial?.hoursCredit ?? ""} placeholder={t("adm2.shifts.form.creditPh")} />
          </Field>
        </div>
        <Field label={t("adm2.shifts.form.qual")} hint={t("adm2.shifts.form.qualHint")} error={err?.requiredQualification}>
          <Select name="requiredQualification" defaultValue={initial?.requiredQualification ?? ""}>
            <option value="">{t("adm2.common.none")}</option>
            {QUALIFICATION_KINDS.map((k) => <option key={k.key} value={k.key}>{qualificationLabel(k.key, t)}</option>)}
          </Select>
        </Field>
        <Field label={t("adm2.shifts.form.note")} error={err?.note}><Textarea name="note" defaultValue={initial?.note ?? ""} maxLength={191} rows={2} placeholder={t("adm2.shifts.form.notePh")} /></Field>
      </Card>
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} className="w-full sm:w-auto"><Save className="h-4 w-4" /> {initial?.id ? t("adm2.common.save") : t("adm2.shifts.form.create")}</SubmitButton>
    </form>
  );
}
