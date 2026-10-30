"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Alert, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { saveShiftAction } from "@/modules/shifts/actions";
import { QUALIFICATION_KINDS } from "@/modules/qualifications/types";
import { EVENT_KIND_META, isEventKind } from "@/modules/events/types";

export type ShiftEventChoice = { id: string; title: string; kind: string; day: string; time: string | null; endTime: string | null; label: string };

export type ShiftFormValues = {
  id?: string; title: string; eventId: string | null; date: string; startTime: string; endTime: string; capacity: number;
  requiredQualification: string | null; hoursCredit: number | null; note: string | null;
};

/** Einsatz erfassen/bearbeiten. Mit Anlass: Datum und Zeit werden vom Anlass vorgeschlagen. Ohne Anlass: z.B. Standdienst. */
export function ShiftForm({ initial, events, defaultDate }: { initial?: ShiftFormValues; events: ShiftEventChoice[]; defaultDate: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveShiftAction, null);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  const [eventId, setEventId] = useState(initial?.eventId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(initial?.startTime ?? "08:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "12:00");

  useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? "Gespeichert.");
    if (state.data?.id && !initial?.id) router.push(`/admin/shifts/${state.data.id}`);
    else router.refresh();
  }, [state, router, initial?.id]);

  function pickEvent(id: string) {
    setEventId(id);
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    setDate(ev.day);
    if (ev.time) setStartTime(ev.time);
    if (ev.endTime) setEndTime(ev.endTime);
    if (!title.trim()) setTitle(ev.kind === "WORK" ? "Arbeitseinsatz" : "Helfer");
  }

  const groups = new Map<string, ShiftEventChoice[]>();
  for (const e of events) {
    const k = isEventKind(e.kind) ? EVENT_KIND_META[e.kind].plural : "Andere";
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Card className="animate-rise space-y-3 p-4">
        <Field label="Anlass" hint="Ohne Anlass: eigenständiger Einsatz, z.B. Standdienst oder Arbeitstag." error={err?.eventId}>
          <Select name="eventId" value={eventId} onChange={(e) => pickEvent(e.target.value)}>
            <option value="">Kein Anlass (Standdienst, Arbeitstag …)</option>
            {[...groups].map(([label, list]) => (
              <optgroup key={label} label={label}>
                {list.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Bezeichnung" error={err?.title}>
          <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={191} placeholder="z.B. Standdienst, Festwirtschaft, Warner 300 m" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Datum" error={err?.date}><Input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
          <Field label="Von" error={err?.startTime}><Input type="time" name="startTime" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></Field>
          <Field label="Bis" hint="Früher als «Von» = am Folgetag" error={err?.endTime}><Input type="time" name="endTime" value={endTime} onChange={(e) => setEndTime(e.target.value)} required /></Field>
        </div>
      </Card>
      <Card className="animate-rise space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Anzahl Personen" error={err?.capacity}><Input name="capacity" inputMode="numeric" defaultValue={initial?.capacity ?? 2} required /></Field>
          <Field label="Angerechnete Stunden" hint="Leer = Dauer des Einsatzes" error={err?.hoursCredit}>
            <Input name="hoursCredit" inputMode="decimal" defaultValue={initial?.hoursCredit ?? ""} placeholder="z.B. 4" />
          </Field>
        </div>
        <Field label="Verlangte Qualifikation" hint="Mindestens eine eingeteilte Person muss sie gültig haben. Sonst erscheint eine Warnung." error={err?.requiredQualification}>
          <Select name="requiredQualification" defaultValue={initial?.requiredQualification ?? ""}>
            <option value="">Keine</option>
            {QUALIFICATION_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </Select>
        </Field>
        <Field label="Hinweis für Helfende" error={err?.note}><Textarea name="note" defaultValue={initial?.note ?? ""} maxLength={191} rows={2} placeholder="z.B. Treffpunkt Schützenhaus, Gehörschutz mitnehmen" /></Field>
      </Card>
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} className="w-full sm:w-auto"><Save className="h-4 w-4" /> {initial?.id ? "Speichern" : "Einsatz erfassen"}</SubmitButton>
    </form>
  );
}
