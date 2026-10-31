"use client";

import { useActionState } from "react";
import { Alert, Card, Field, Textarea } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { closeIncidentAction } from "@/modules/range/actions";

/** Vorfall mit Massnahmen abschliessen (range.manage). */
export function IncidentClose({ id, measures, closed }: { id: string; measures: string | null; closed: boolean }) {
  const [state, action, pending] = useActionState(closeIncidentAction, null);
  return (
    <Card className="p-4">
      <form onSubmit={submitKeepingValues(action)} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <h2 className="font-semibold">{closed ? "Massnahmen" : "Abschliessen"}</h2>
        <Field label="Getroffene Massnahmen" hint="Was wurde unternommen, damit es nicht wieder passiert? Meldung an Versicherung erfolgt?" error={state && !state.ok ? state.fieldErrors?.measures : undefined}>
          <Textarea name="measures" defaultValue={measures ?? ""} required maxLength={5000} rows={4} />
        </Field>
        {state && !state.ok && !state.fieldErrors ? <Alert>{state.error}</Alert> : state?.ok ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton pending={pending} className="w-full sm:w-auto">{closed ? "Massnahmen speichern" : "Abschliessen"}</SubmitButton>
      </form>
    </Card>
  );
}
