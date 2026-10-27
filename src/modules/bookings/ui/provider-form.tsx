"use client";

import { useActionState } from "react";
import { saveProviderConfigAction } from "@/modules/bookings/actions";
import { PROVIDER_FIELDS, type PaymentProviderKey } from "@/modules/bookings/types";
import { Alert, Badge, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";

export function ProviderForm({ provider, label, hint, configured, enabled, tenantId, appUrl }: { provider: PaymentProviderKey; label: string; hint: string; configured: boolean; enabled: boolean; tenantId: string; appUrl: string }) {
  const [state, action] = useActionState(saveProviderConfigAction, null);
  const fields = PROVIDER_FIELDS[provider];
  return (
    <Card className="animate-rise p-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="provider" value={provider} />
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="font-semibold">{label}</h3><p className="text-xs text-ink-3">{hint}</p></div>
          {enabled ? <Badge tone="ok">aktiv</Badge> : configured ? <Badge>eingerichtet</Badge> : <Badge tone="outline">nicht eingerichtet</Badge>}
        </div>
        {fields.map((f) =>
          f.options ? (
            <Field key={f.key} label={f.label}><Select name={f.key} defaultValue={f.options[0]}>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}</Select></Field>
          ) : (
            <Field key={f.key} label={f.label} hint={f.secret && configured ? "Leer lassen, um den gespeicherten Wert zu behalten." : f.hint}>
              <Input name={f.key} type={f.secret ? "password" : "text"} autoComplete="off" placeholder={f.secret && configured ? "••••••••" : ""} className="font-mono text-sm" />
            </Field>
          ),
        )}
        {provider === "STRIPE" ? <p className="text-xs text-ink-3">Webhook-Endpoint im Stripe-Dashboard: <code className="font-mono break-all">{appUrl}/api/payments/stripe/{tenantId}</code> (Ereignis «checkout.session.completed»). Ohne Webhook wird die Zahlung beim Rücksprung geprüft.</p> : null}
        <label className="flex items-center gap-3"><input type="checkbox" name="enabled" defaultChecked={enabled} className="h-5 w-5 accent-[var(--ink)]" /><span className="text-sm font-medium">Aktiviert</span></label>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton variant="secondary" size="sm">Speichern</SubmitButton>
      </form>
    </Card>
  );
}
