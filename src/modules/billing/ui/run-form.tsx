"use client";

import { useActionState, useState } from "react";
import { createRunAction } from "@/modules/billing/actions";
import { Alert, Card, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { Switch } from "@/components/ui/controls";
import { useT } from "@/components/locale";

export function RunForm({ year, defaults, eligible, invoices, alreadyInvoiced }: {
  year: number;
  defaults: { title: string; invoicePrefix: string; dueDays: number; note: string | null };
  /** Mitglieder, die noch eine Rechnung erhalten (ohne Ausgetretene und ohne bereits in einer Haushaltsrechnung Enthaltene) */
  eligible: number;
  /** Anzahl Rechnungen mit bzw. ohne «Haushalte zusammenfassen» */
  invoices: { combined: number; separate: number };
  alreadyInvoiced: number;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(createRunAction, null);
  const [combine, setCombine] = useState(true);
  const count = combine ? invoices.combined : invoices.separate;
  return (
    <Card className="animate-rise p-4">
      <form onSubmit={submitKeepingValues(action)} className="space-y-3">
        <h3 className="font-semibold">{t("adm1.run.create", { year })}</h3>
        <p className="text-sm text-ink-3">
          {t(eligible === 1 ? "adm1.run.eligible.one" : "adm1.run.eligible.other", { n: eligible })}
          {combine && count !== eligible ? ` (${t(count === 1 ? "adm1.run.combined.one" : "adm1.run.combined.other", { n: count })})` : ""}
          {alreadyInvoiced ? ` · ${t(alreadyInvoiced === 1 ? "adm1.run.already.one" : "adm1.run.already.other", { n: alreadyInvoiced })}` : ""}. {t("adm1.run.skipped")}
        </p>
        <div className="grid grid-cols-[90px_1fr] gap-3">
          <Field label={t("adm1.common.year")}><Input name="year" type="number" defaultValue={year} readOnly className="bg-surface-2" /></Field>
          <Field label={t("adm1.run.title")}><Input name="title" defaultValue={defaults.title} required /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("adm1.run.prefix")}><Input name="invoicePrefix" defaultValue={defaults.invoicePrefix} /></Field>
          <Field label={t("adm1.run.dueDays")}><Input name="dueDays" type="number" inputMode="numeric" min={1} defaultValue={defaults.dueDays} /></Field>
        </div>
        <Field label={t("adm1.run.note")}><Textarea name="note" defaultValue={defaults.note ?? ""} className="min-h-16" placeholder={t("adm1.run.notePlaceholder")} /></Field>
        <Switch label={t("adm1.run.combine")} description={t("adm1.run.combineHint")} checked={combine} onChange={setCombine} />
        <input type="hidden" name="combineHouseholds" value={combine ? "on" : "off"} />
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <SubmitButton pending={pending} disabled={eligible === 0} pendingText={t("adm1.run.creating")}>{eligible === 0 ? t("adm1.run.noneOpen") : t(count === 1 ? "adm1.run.submit.one" : "adm1.run.submit.other", { n: count })}</SubmitButton>
      </form>
    </Card>
  );
}
