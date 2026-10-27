"use client";

import { useActionState } from "react";
import { saveBillingProfileAction } from "@/modules/billing/actions";
import type { BillingProfileView } from "@/modules/billing/profile";
import { Alert, Badge, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";

export function BillingProfileForm({ profile }: { profile: BillingProfileView }) {
  const [state, action] = useActionState(saveBillingProfileAction, null);
  return (
    <Card className="animate-rise p-4">
      <form action={action} className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Zahlungsempfänger</h3>{profile.qrReady ? <Badge tone="ok">QR-Rechnung bereit</Badge> : <Badge tone="warn">unvollständig</Badge>}</div>
        <p className="text-xs text-ink-3">Diese Angaben stehen auf allen Rechnungen (Mitgliederbeiträge und Reservationen) und im QR-Zahlteil.</p>
        <Field label="Name"><Input name="payeeName" defaultValue={profile.payeeName ?? ""} placeholder="Schützengesellschaft Musterhausen" /></Field>
        <Field label="Strasse und Nr."><Input name="payeeStreet" defaultValue={profile.payeeStreet ?? ""} placeholder="Schützenstrasse 1" /></Field>
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Field label="PLZ"><Input name="payeeZip" defaultValue={profile.payeeZip ?? ""} /></Field>
          <Field label="Ort"><Input name="payeeCity" defaultValue={profile.payeeCity ?? ""} /></Field>
        </div>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label="IBAN" hint="Normale IBAN oder QR-IBAN des Vereinskontos."><Input name="iban" defaultValue={profile.iban ?? ""} placeholder="CH93 0076 2011 6238 5295 7" className="font-mono" /></Field>
          <Field label="Währung"><Select name="currency" defaultValue={profile.currency}><option value="CHF">CHF</option><option value="EUR">EUR</option></Select></Field>
        </div>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton>Speichern</SubmitButton>
      </form>
    </Card>
  );
}
