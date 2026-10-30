"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Alert, Field, Input } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import { createSessionAction } from "@/modules/courses/actions";

/** Neue Lektion, optional mit Eintrag im Vereinskalender (Anlass «Training»). */
export function SessionForm({ courseId, defaultDate, eventsEnabled, nextNumber }: { courseId: string; defaultDate: string; eventsEnabled: boolean; nextNumber: number }) {
  const [state, action, pending] = useActionState(createSessionAction, null);
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
      <Field label="Titel" error={err?.title}><Input name="title" defaultValue={`Lektion ${nextNumber}`} required maxLength={191} /></Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Datum" error={err?.date} className="col-span-2"><Input type="date" name="date" defaultValue={defaultDate} required /></Field>
        <Field label="Beginn" error={err?.startTime}><Input type="time" name="startTime" defaultValue="18:00" required /></Field>
        <Field label="Ende" error={err?.endTime}><Input type="time" name="endTime" defaultValue="20:00" /></Field>
      </div>
      <Field label="Ort" error={err?.location}><Input name="location" maxLength={191} placeholder="z.B. Schiessanlage 300 m" /></Field>
      {eventsEnabled ? (
        <Switch label="Im Vereinskalender eintragen" description="Erstellt einen Anlass «Training» ohne An-/Abmeldung." checked={createEvent} onChange={setCreateEvent} />
      ) : null}
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} className="w-full sm:w-auto"><Plus className="h-4 w-4" /> Lektion erstellen</SubmitButton>
    </form>
  );
}
