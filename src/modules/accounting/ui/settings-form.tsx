"use client";

import { useActionState } from "react";
import { RotateCcw } from "lucide-react";
import { saveAccountingSettingsAction } from "@/modules/accounting/actions";
import { ACCOUNT_FIELDS, DEFAULT_ACCOUNTS, type AccountPlan } from "@/modules/accounting/types";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import type { ActionResult } from "@/lib/action-result";

type FormState = { result: ActionResult<AccountPlan> | null; okCount: number };

export function AccountingSettingsForm({ accounts }: { accounts: AccountPlan }) {
  // okCount zählt erfolgreiche Aktionen: Der Remount-Key darf nicht nur von den Werten abhängen,
  // sonst bleibt ein geleertes Feld nach "Standard wiederherstellen" leer, wenn der gespeicherte
  // Plan schon dem Standard entsprach (gleiche Werte → gleicher Key → kein Remount).
  const [{ result: state, okCount }, action, pending] = useActionState(
    async (prev: FormState, formData: FormData): Promise<FormState> => {
      const result = await saveAccountingSettingsAction(prev.result, formData);
      return { result, okCount: result.ok ? prev.okCount + 1 : prev.okCount };
    },
    { result: null, okCount: 0 },
  );
  const values = state?.ok && state.data ? state.data : accounts;
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <Card className="animate-rise p-4">
      {/* key: nach jedem Erfolg (Speichern/Zurücksetzen) neu aufbauen und die gespeicherten Werte zeigen;
          bei Validierungsfehlern bleibt der Key gleich, damit die Eingaben erhalten bleiben */}
      <form key={okCount} onSubmit={submitKeepingValues(action)} className="space-y-4">
        <p className="text-sm text-ink-2">
          Vorschlag nach dem Schweizer KMU-Kontenrahmen. Passt die Nummern an euren Kontenplan in Banana oder bexio an; jedes Konto muss dort existieren, sonst lehnt der Import die Buchung ab.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {ACCOUNT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={`${f.hint} Standard: ${DEFAULT_ACCOUNTS[f.key]}.`} error={errors[f.key]}>
              <Input name={f.key} defaultValue={values[f.key]} inputMode="text" autoComplete="off" spellCheck={false} maxLength={20} className="font-mono" required />
            </Field>
          ))}
        </div>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <div className="flex flex-wrap gap-2">
          <SubmitButton pending={pending}>Kontenplan speichern</SubmitButton>
          {/* formNoValidate: der Ausweg aus einem unvollständigen Formular, die Felder zählen beim Zurücksetzen nicht */}
          <Button type="submit" name="intent" value="reset" variant="secondary" disabled={pending} formNoValidate>
            <RotateCcw className="h-4 w-4" aria-hidden /> Standard wiederherstellen
          </Button>
        </div>
      </form>
    </Card>
  );
}
