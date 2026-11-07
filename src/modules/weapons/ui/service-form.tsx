"use client";

import { useActionState, useEffect, useRef } from "react";
import { Wrench } from "lucide-react";
import { Alert, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { addServiceAction } from "@/modules/weapons/actions";
import { SERVICE_KINDS, serviceKindLabel } from "@/modules/weapons/types";
import { useT } from "@/components/locale";

/** «Wartung erfassen»: Datum, Art, Notiz, Kosten, durch wen; optional Waffe wieder freigeben und nächstes Datum setzen. */
export function ServiceForm({ weaponId, today, status, currency = "CHF" }: { weaponId: string; today: string; status: string; currency?: string }) {
  const [state, action, pending] = useActionState(addServiceAction, null);
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  const canRelease = status === "SERVICE" || status === "BLOCKED";

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Card className="animate-rise p-4">
      <form ref={formRef} onSubmit={submitKeepingValues(action)} className="space-y-3">
        <input type="hidden" name="weaponId" value={weaponId} />
        <h3 className="font-semibold">{t("adm2.weapons.service.title")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("adm2.common.date")} error={err?.date}><Input type="date" name="date" defaultValue={today} max={today} required /></Field>
          <Field label={t("adm2.weapons.service.kind")} error={err?.kind}>
            <Select name="kind" defaultValue="SERVICE">
              {SERVICE_KINDS.map((k) => <option key={k} value={k}>{serviceKindLabel(k, t)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={t("adm2.weapons.service.what")} error={err?.note}><Input name="note" maxLength={191} placeholder={t("adm2.weapons.service.whatPh")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("adm2.weapons.service.cost", { currency })} error={err?.cost}><Input name="cost" inputMode="decimal" placeholder="0.00" /></Field>
          <Field label={t("adm2.weapons.service.by")} error={err?.byName}><Input name="byName" maxLength={191} placeholder={t("adm2.weapons.service.byPh")} /></Field>
        </div>
        <Field label={t("adm2.weapons.service.next")} error={err?.nextServiceAt}><Input type="date" name="nextServiceAt" min={today} /></Field>
        {canRelease ? (
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="release" value="on" defaultChecked className="h-5 w-5 accent-[var(--ink)]" />
            <span className="text-sm font-medium">{t("adm2.weapons.service.release")}</span>
          </label>
        ) : null}
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton pending={pending}><Wrench className="h-4 w-4" /> {t("adm2.weapons.service.submit")}</SubmitButton>
      </form>
    </Card>
  );
}
