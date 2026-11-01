"use client";

import { useActionState, useState } from "react";
import { PAYMENT_PROVIDERS, providerFees, type PaymentProviderKey } from "@/lib/payments/catalog";
import { Alert, Badge, Card, Field, Select } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveOnlineFeeProviderAction } from "./actions";

export function OnlineFeeProviderForm({ current, enabledProviders, setupHref }: { current: string; enabledProviders: PaymentProviderKey[]; setupHref: string | null }) {
  const [state, action, pending] = useActionState(saveOnlineFeeProviderAction, null);
  const [value, setValue] = useState(current);
  const fees = providerFees(value);
  return (
    <Card className="animate-rise p-4">
      <form onSubmit={submitKeepingValues(action)} className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Online-Zahlung von Rechnungen</h3>
          {current !== "NONE" ? <Badge tone="ok">aktiv</Badge> : <Badge tone="outline">aus</Badge>}
        </div>
        <p className="text-xs text-ink-3">
          Mitglieder sehen bei offenen Rechnungen (Jahresbeitrag, Ersatzabgabe, Schützenstube und weitere Vereinsrechnungen) zusätzlich den Knopf «Online bezahlen» (je nach Anbieter mit TWINT, PostFinance oder Karte). Die Rechnung wird nach der Zahlung automatisch als bezahlt markiert. Munition bleibt immer auf Rechnung.
        </p>
        <Field label="Zahlungsanbieter">
          <Select name="onlineFeeProvider" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="NONE">Keiner (nur QR-Rechnung)</option>
            {PAYMENT_PROVIDERS.map((p) => {
              const on = enabledProviders.includes(p.key);
              return <option key={p.key} value={p.key} disabled={!on}>{p.label}{on ? "" : " (nicht eingerichtet)"}</option>;
            })}
          </Select>
        </Field>
        {fees ? (
          <Alert tone="info" title="Gebühren">
            {fees} Die Gebühr trägt der Verein; der Rechnungsbetrag bleibt unverändert. Mit der QR-Rechnung fallen keine Gebühren an.
          </Alert>
        ) : null}
        {!enabledProviders.length ? (
          <p className="text-xs text-ink-3">
            Noch kein Zahlungsanbieter eingerichtet.{" "}
            {setupHref ? <a href={setupHref} className="underline">Jetzt einrichten</a> : "Unten einrichten und aktivieren."}
          </p>
        ) : null}
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton pending={pending} variant="secondary" className="min-h-11">Speichern</SubmitButton>
      </form>
    </Card>
  );
}
