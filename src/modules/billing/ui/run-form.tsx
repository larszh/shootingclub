"use client";

import { useActionState, useState } from "react";
import { createRunAction } from "@/modules/billing/actions";
import { Alert, Card, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { Switch } from "@/components/ui/controls";

export function RunForm({ year, defaults, eligible, invoices, alreadyInvoiced }: {
  year: number;
  defaults: { title: string; invoicePrefix: string; dueDays: number; note: string | null };
  /** Mitglieder, die noch eine Rechnung erhalten (ohne Ausgetretene und ohne bereits in einer Haushaltsrechnung Enthaltene) */
  eligible: number;
  /** Anzahl Rechnungen mit bzw. ohne «Haushalte zusammenfassen» */
  invoices: { combined: number; separate: number };
  alreadyInvoiced: number;
}) {
  const [state, action, pending] = useActionState(createRunAction, null);
  const [combine, setCombine] = useState(true);
  const count = combine ? invoices.combined : invoices.separate;
  return (
    <Card className="animate-rise p-4">
      <form onSubmit={submitKeepingValues(action)} className="space-y-3">
        <h3 className="font-semibold">Jahresrechnungen {year} erstellen</h3>
        <p className="text-sm text-ink-3">
          {eligible} {eligible === 1 ? "Mitglied erhält" : "Mitglieder erhalten"} eine Rechnung{combine && count !== eligible ? ` (${count} ${count === 1 ? "Rechnung" : "Rechnungen"}, Haushalte zusammengefasst)` : ""}{alreadyInvoiced ? `, ${alreadyInvoiced} ${alreadyInvoiced === 1 ? "ist" : "sind"} bereits verrechnet` : ""}. Ausgetretene, Mitglieder ohne Kategorie oder mit Beitrag 0 werden übersprungen.
        </p>
        <div className="grid grid-cols-[90px_1fr] gap-3">
          <Field label="Jahr"><Input name="year" type="number" defaultValue={year} readOnly className="bg-surface-2" /></Field>
          <Field label="Titel auf der Rechnung"><Input name="title" defaultValue={defaults.title} required /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nummernpräfix"><Input name="invoicePrefix" defaultValue={defaults.invoicePrefix} /></Field>
          <Field label="Zahlungsfrist (Tage)"><Input name="dueDays" type="number" inputMode="numeric" min={1} defaultValue={defaults.dueDays} /></Field>
        </div>
        <Field label="Hinweistext (optional)"><Textarea name="note" defaultValue={defaults.note ?? ""} className="min-h-16" placeholder="z.B. Vielen Dank für deine Treue. Der Beitrag umfasst den Verbandsbeitrag." /></Field>
        <Switch label="Haushalte zusammenfassen" description="Mitglieder eines Haushalts erhalten eine gemeinsame Rechnung an die zahlende Person." checked={combine} onChange={setCombine} />
        <input type="hidden" name="combineHouseholds" value={combine ? "on" : "off"} />
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <SubmitButton pending={pending} disabled={eligible === 0} pendingText="Rechnungen werden erstellt…">{eligible === 0 ? "Keine offenen Mitglieder" : `${count} ${count === 1 ? "Rechnung" : "Rechnungen"} erstellen`}</SubmitButton>
      </form>
    </Card>
  );
}
