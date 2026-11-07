"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Alert, Field, Input } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import { createSessionAction } from "@/modules/courses/actions";
import { useT } from "@/components/locale";

/** Neue Lektion, optional mit Eintrag im Vereinskalender (Anlass «Training»). */
export function SessionForm({ courseId, defaultDate, eventsEnabled, nextNumber }: { courseId: string; defaultDate: string; eventsEnabled: boolean; nextNumber: number }) {
  const [state, action, pending] = useActionState(createSessionAction, null);
  const tr = useT();
  const err = state && !state.ok ? state.fieldErrors : undefined;
  const formRef = useRef<HTMLFormElement>(null);
  const [createEvent, setCreateEvent] = useState(eventsEnabled);
  const [formKey, setFormKey] = useState(0);
  const handled = useRef<unknown>(null);

  useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state;
      if (state.message) toast.success(state.message);
      // Formular für die nächste Lektion leeren (neuer key) – ausserhalb des Renderns.
      const t = setTimeout(() => setFormKey((k) => k + 1), 0);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <form key={formKey} ref={formRef} onSubmit={submitKeepingValues(action)} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="createEvent" value={createEvent ? "on" : ""} />
      <Field label={tr("adm2.common.title")} error={err?.title}><Input name="title" defaultValue={tr("adm2.courses.session.lesson", { n: nextNumber })} required maxLength={191} /></Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={tr("adm2.common.date")} error={err?.date} className="col-span-2"><Input type="date" name="date" defaultValue={defaultDate} required /></Field>
        <Field label={tr("adm2.common.start")} error={err?.startTime}><Input type="time" name="startTime" defaultValue="18:00" required /></Field>
        <Field label={tr("adm2.common.end")} error={err?.endTime}><Input type="time" name="endTime" defaultValue="20:00" /></Field>
      </div>
      <Field label={tr("adm2.common.location")} error={err?.location}><Input name="location" maxLength={191} placeholder={tr("adm2.courses.session.placePh")} /></Field>
      {eventsEnabled ? (
        <Switch label={tr("adm2.courses.session.calendar")} description={tr("adm2.courses.session.calendarHint")} checked={createEvent} onChange={setCreateEvent} />
      ) : null}
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} className="w-full sm:w-auto"><Plus className="h-4 w-4" /> {tr("adm2.courses.session.create")}</SubmitButton>
    </form>
  );
}
