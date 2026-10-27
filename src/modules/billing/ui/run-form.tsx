"use client";

import { useActionState } from "react";
import { createRunAction } from "@/modules/billing/actions";
import { Alert, Card, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";

export function RunForm({ year, defaults, eligible, alreadyInvoiced }: { year: number; defaults: { title: string; invoicePrefix: string; dueDays: number; note: string | null }; eligible: number; alreadyInvoiced: number }) {
  const [state, action] = useActionState(createRunAction, null);
  return (
    <Card className="animate-rise p-4">
      <form action={action} className="space-y-3">
        <h3 className="font-semibold">Jahresrechnungen {year} erstellen</h3>
        <p className="text-sm text-ink-3">{eligible} {eligible === 1 ? "Mitglied erhält" : "Mitglieder erhalten"} eine Rechnung{alreadyInvoiced ? `, ${alreadyInvoiced} haben bereits eine` : ""}. Mitglieder ohne Kategorie oder mit Beitrag 0 werden übersprungen.</p>
        <div className="grid grid-cols-[90px_1fr] gap-3">
          <Field label="Jahr"><Input name="year" type="number" defaultValue={year} readOnly className="bg-surface-2" /></Field>
          <Field label="Titel auf der Rechnung"><Input name="title" defaultValue={defaults.title} required /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nummernpräfix"><Input name="invoicePrefix" defaultValue={defaults.invoicePrefix} /></Field>
          <Field label="Zahlungsfrist (Tage)"><Input name="dueDays" type="number" inputMode="numeric" min={1} defaultValue={defaults.dueDays} /></Field>
        </div>
        <Field label="Hinweistext (optional)"><Textarea name="note" defaultValue={defaults.note ?? ""} className="min-h-16" placeholder="z.B. Vielen Dank für deine Treue. Der Beitrag umfasst den Verbandsbeitrag." /></Field>
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <SubmitButton disabled={eligible === 0} pendingText="Rechnungen werden erstellt…">{eligible === 0 ? "Keine offenen Mitglieder" : `${eligible} Rechnungen erstellen`}</SubmitButton>
      </form>
    </Card>
  );
}
