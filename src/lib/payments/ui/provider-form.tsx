"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { PlugZap } from "lucide-react";
import { savePaymentProviderAction, testPaymentProviderAction } from "@/lib/payments/actions";
import { PROVIDER_FIELDS, TESTABLE_PROVIDERS, webhookPath, type PaymentProviderKey } from "@/lib/payments/catalog";
import type { ActionResult } from "@/lib/action-result";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";

export type ProviderFormProps = {
  provider: PaymentProviderKey;
  label: string;
  hint: string;
  configured: boolean;
  enabled: boolean;
  tenantId: string;
  appUrl: string;
  /** Gespeicherte, nicht geheime Werte (z.B. Instanzname) zum Vorausfüllen */
  values?: Record<string, string>;
};

/** Zugangsdaten eines Zahlungsanbieters (geheime Felder nur schreibbar, nie angezeigt). */
export function PaymentProviderForm({ provider, label, hint, configured, enabled, tenantId, appUrl, values = {} }: ProviderFormProps) {
  const [state, action, pending] = useActionState(savePaymentProviderAction, null);
  const [testState, setTestState] = useState<ActionResult | null>(null);
  const [testing, startTest] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fields = PROVIDER_FIELDS[provider];
  const hook = webhookPath(provider, tenantId);
  const testable = TESTABLE_PROVIDERS.has(provider);

  const runTest = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    startTest(async () => {
      try {
        setTestState(await testPaymentProviderAction(fd));
      } catch {
        setTestState({ ok: false, error: "Keine Verbindung. Bitte nochmals versuchen." });
      }
    });
  };

  return (
    <Card className="animate-rise p-4">
      <form ref={formRef} onSubmit={submitKeepingValues(action)} className="space-y-3">
        <input type="hidden" name="provider" value={provider} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="font-semibold">{label}</h3><p className="text-xs text-ink-3">{hint}</p></div>
          <div className="shrink-0">{enabled ? <Badge tone="ok">aktiv</Badge> : configured ? <Badge>eingerichtet</Badge> : <Badge tone="outline">nicht eingerichtet</Badge>}</div>
        </div>
        {fields.map((f) =>
          f.options ? (
            <Field key={f.key} label={f.label}>
              <Select name={f.key} defaultValue={values[f.key] && f.options.includes(values[f.key]!) ? values[f.key] : f.options[0]}>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            </Field>
          ) : (
            <Field key={f.key} label={f.label} hint={f.secret && configured ? "Leer lassen, um den gespeicherten Wert zu behalten." : f.hint}>
              <Input
                name={f.key}
                type={f.secret ? "password" : "text"}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={500}
                defaultValue={f.secret ? undefined : values[f.key] ?? ""}
                placeholder={f.secret && configured ? "••••••••" : ""}
                className="font-mono text-sm"
              />
            </Field>
          ),
        )}
        {hook ? (
          <p className="text-xs text-ink-3">
            Webhook-Endpoint: <code className="font-mono break-all">{appUrl}{hook}</code>
            {provider === "STRIPE" ? " (Ereignis «checkout.session.completed»)." : " (Payrexx-Backend → Webhooks, Typ «Transaktion»)."} Ohne Webhook wird die Zahlung beim Rücksprung geprüft.
          </p>
        ) : null}
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="enabled" defaultChecked={enabled} className="h-5 w-5 accent-[var(--ink)]" />
          <span className="text-sm font-medium">Aktiviert</span>
        </label>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        {testState && !testState.ok ? <Alert>{testState.error}</Alert> : testState?.ok && testState.message ? <Alert tone="ok">{testState.message}</Alert> : null}
        <div className="flex flex-wrap gap-2">
          <SubmitButton pending={pending} variant="secondary" className="min-h-11">Speichern</SubmitButton>
          {testable ? (
            <Button type="button" variant="ghost" className="min-h-11" disabled={testing} onClick={runTest}>
              <PlugZap className="h-4 w-4" aria-hidden /> {testing ? "Teste…" : "Verbindung testen"}
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
