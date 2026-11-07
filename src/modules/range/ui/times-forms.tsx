"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { addWindowsAction, saveQuotaAction } from "@/modules/range/actions";
import { WEEKDAY_ORDER } from "@/modules/range/logic";
import { useT } from "@/components/locale";

type Resource = { id: string; name: string };

export function WindowForm({ resources }: { resources: Resource[] }) {
  const [state, action, pending] = useActionState(addWindowsAction, null);
  const ref = useRef<HTMLFormElement>(null);
  const t = useT();
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <Card className="animate-rise p-4">
      <form ref={ref} onSubmit={submitKeepingValues(action)} className="space-y-3">
        <h2 className="font-semibold">{t("adm2.range.times.addWindow")}</h2>
        <Field label={t("adm2.common.resource")}>
          <Select name="resourceId" defaultValue="">
            <option value="">{t("adm2.common.wholeFacility")}</option>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink-2">{t("adm2.range.times.weekdays")}</legend>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_ORDER.map((d) => (
              <label key={d} className="relative">
                <input type="checkbox" name="weekday" value={d} className="peer sr-only" />
                <span className="press flex h-11 cursor-pointer items-center justify-center rounded-control border border-line bg-surface text-sm font-medium text-ink-2 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-bg peer-focus-visible:outline-2 peer-focus-visible:outline-accent">{t(`adm2.weekdayShort.${d}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("adm2.common.from")}><Input type="time" name="start" defaultValue="09:00" required /></Field>
          <Field label={t("adm2.common.to")}><Input type="time" name="end" defaultValue="12:00" required /></Field>
        </div>
        <Field label={t("adm2.range.board.remarkOpt")} hint={t("adm2.range.times.noteHint")}><Input name="note" maxLength={191} /></Field>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton pending={pending} className="w-full sm:w-auto">{t("adm2.common.add")}</SubmitButton>
      </form>
    </Card>
  );
}

export function QuotaForm({ resources, year }: { resources: Resource[]; year: number }) {
  const [state, action, pending] = useActionState(saveQuotaAction, null);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  const t = useT();
  return (
    <Card className="animate-rise p-4">
      <form onSubmit={submitKeepingValues(action)} className="space-y-3">
        <h2 className="font-semibold">{t("adm2.range.times.quotaTitle")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("adm2.common.year")} error={err?.year}><Input name="year" inputMode="numeric" defaultValue={year} required /></Field>
          <Field label={t("adm2.range.times.maxHalfDays")} error={err?.maxHalfDays}><Input name="maxHalfDays" inputMode="numeric" placeholder={t("adm2.range.times.maxPlaceholder")} required /></Field>
        </div>
        <Field label={t("adm2.common.resource")}>
          <Select name="resourceId" defaultValue="">
            <option value="">{t("adm2.common.wholeFacility")}</option>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label={t("adm2.range.board.remarkOpt")} hint={t("adm2.range.times.quotaNoteHint")}><Input name="note" maxLength={191} /></Field>
        {state && !state.ok && !state.fieldErrors ? <Alert>{state.error}</Alert> : state?.ok ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton pending={pending} className="w-full sm:w-auto">{t("adm2.common.save")}</SubmitButton>
        <p className="text-xs text-ink-3">{t("adm2.range.times.quotaFooter")} {t("adm2.common.checkHint")}</p>
      </form>
    </Card>
  );
}
