"use client";

import { useActionState } from "react";
import { Alert, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveFederalYearAction } from "@/modules/federal/actions";
import { DEADLINE_FIELDS } from "@/modules/federal/types";
import { useT } from "@/components/locale";

type Props = {
  year: number;
  values: { registrationDeadline: string | null; shootingDeadline: string | null; reportDeadline: string | null; notes: string };
};

/** Fristen und Notizen eines Jahres (Schützenmeister/Admin). Leere Felder = keine Frist. */
export function FederalYearForm({ year, values }: Props) {
  const [state, action, pending] = useActionState(saveFederalYearAction, null);
  const t = useT();
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      <input type="hidden" name="year" value={year} />
      <div className="grid gap-3 sm:grid-cols-3">
        {DEADLINE_FIELDS.map((f) => (
          <Field key={f.key} label={t(`adm2.federal.dl.${f.key}`)} hint={t(`adm2.federal.dl.${f.key}.hint`)} error={err[f.key]}>
            <Input type="date" name={f.key} defaultValue={values[f.key] ?? ""} className="h-11" />
          </Field>
        ))}
      </div>
      <Field label={t("adm2.federal.year.notes")} hint={t("adm2.federal.year.notesHint")} error={err.notes}>
        <Textarea name="notes" defaultValue={values.notes} rows={3} maxLength={5000} />
      </Field>
      <p className="text-xs text-ink-3">{t("adm2.federal.year.empty")} {t("adm2.federal.rulesHint")} {t("adm2.federal.year.reminders")}</p>
      {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok ? <Alert tone="ok">{t("adm2.common.saved")}</Alert> : null}
      <SubmitButton pending={pending} className="h-11" pendingText={t("adm2.federal.year.saving")}>{t("adm2.federal.year.submit")}</SubmitButton>
    </form>
  );
}
