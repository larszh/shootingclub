"use client";

import { useActionState } from "react";
import { Alert, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveFederalYearAction } from "@/modules/federal/actions";
import { DEADLINE_FIELDS, FEDERAL_RULES_HINT } from "@/modules/federal/types";

type Props = {
  year: number;
  values: { registrationDeadline: string | null; shootingDeadline: string | null; reportDeadline: string | null; notes: string };
};

/** Fristen und Notizen eines Jahres (Schützenmeister/Admin). Leere Felder = keine Frist. */
export function FederalYearForm({ year, values }: Props) {
  const [state, action, pending] = useActionState(saveFederalYearAction, null);
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      <input type="hidden" name="year" value={year} />
      <div className="grid gap-3 sm:grid-cols-3">
        {DEADLINE_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} error={err[f.key]}>
            <Input type="date" name={f.key} defaultValue={values[f.key] ?? ""} className="h-11" />
          </Field>
        ))}
      </div>
      <Field label="Notizen (optional)" hint="z.B. Schiesstage, Zuständigkeiten, Absprachen mit der Gemeinde" error={err.notes}>
        <Textarea name="notes" defaultValue={values.notes} rows={3} maxLength={5000} />
      </Field>
      <p className="text-xs text-ink-3">Fristen sind leer, bis du sie einträgst. {FEDERAL_RULES_HINT} Admins werden 14 und 3 Tage vor jeder Frist erinnert.</p>
      {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok ? <Alert tone="ok">Gespeichert.</Alert> : null}
      <SubmitButton pending={pending} className="h-11" pendingText="Speichern…">Fristen speichern</SubmitButton>
    </form>
  );
}
