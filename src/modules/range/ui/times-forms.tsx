"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { addWindowsAction, saveQuotaAction } from "@/modules/range/actions";
import { WEEKDAY_ORDER, WEEKDAYS_SHORT } from "@/modules/range/logic";
import { CHECK_HINT } from "@/modules/range/types";

type Resource = { id: string; name: string };

export function WindowForm({ resources }: { resources: Resource[] }) {
  const [state, action, pending] = useActionState(addWindowsAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <Card className="animate-rise p-4">
      <form ref={ref} onSubmit={submitKeepingValues(action)} className="space-y-3">
        <h2 className="font-semibold">Schiesszeit hinzufügen</h2>
        <Field label="Anlage">
          <Select name="resourceId" defaultValue="">
            <option value="">Ganze Anlage</option>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink-2">Wochentage</legend>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_ORDER.map((d) => (
              <label key={d} className="relative">
                <input type="checkbox" name="weekday" value={d} className="peer sr-only" />
                <span className="press flex h-11 cursor-pointer items-center justify-center rounded-control border border-line bg-surface text-sm font-medium text-ink-2 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-bg peer-focus-visible:outline-2 peer-focus-visible:outline-accent">{WEEKDAYS_SHORT[d]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Von"><Input type="time" name="start" defaultValue="09:00" required /></Field>
          <Field label="Bis"><Input type="time" name="end" defaultValue="12:00" required /></Field>
        </div>
        <Field label="Bemerkung (optional)" hint="z.B. «gemäss Bewilligung Gemeinde 2026», «nicht an Feiertagen»"><Input name="note" maxLength={191} /></Field>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton pending={pending} className="w-full sm:w-auto">Hinzufügen</SubmitButton>
      </form>
    </Card>
  );
}

export function QuotaForm({ resources, year }: { resources: Resource[]; year: number }) {
  const [state, action, pending] = useActionState(saveQuotaAction, null);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <Card className="animate-rise p-4">
      <form onSubmit={submitKeepingValues(action)} className="space-y-3">
        <h2 className="font-semibold">Kontingent Schiesshalbtage</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jahr" error={err?.year}><Input name="year" inputMode="numeric" defaultValue={year} required /></Field>
          <Field label="Max. Halbtage" error={err?.maxHalfDays}><Input name="maxHalfDays" inputMode="numeric" placeholder="z.B. 80" required /></Field>
        </div>
        <Field label="Anlage">
          <Select name="resourceId" defaultValue="">
            <option value="">Ganze Anlage</option>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="Bemerkung (optional)" hint="z.B. Bewilligung, Aktenzeichen der Gemeinde"><Input name="note" maxLength={191} /></Field>
        {state && !state.ok && !state.fieldErrors ? <Alert>{state.error}</Alert> : state?.ok ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton pending={pending} className="w-full sm:w-auto">Speichern</SubmitButton>
        <p className="text-xs text-ink-3">Gibt es schon ein Kontingent für dieses Jahr und diese Anlage, wird es überschrieben. Massgebend ist die Bewilligung der Gemeinde bzw. des Kantons. {CHECK_HINT}</p>
      </form>
    </Card>
  );
}
