"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { PlugZap } from "lucide-react";
import { savePaymentProviderAction, testPaymentProviderAction } from "@/lib/payments/actions";
import { PROVIDER_FIELDS, TESTABLE_PROVIDERS, webhookPath, type PaymentProviderKey } from "@/lib/payments/catalog";
import type { ActionResult } from "@/lib/action-result";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { useT } from "@/components/locale";
import type { TFunction } from "@/lib/i18n/core";

/** Übersetzter Text aus dem Wörterbuch, sonst der deutsche Katalogtext (z.B. Anbieter ohne Eintrag). */
function tOr(t: TFunction, key: string, fallback: string) {
  const v = t(key);
  return v === key ? fallback : v;
}

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
  const t = useT();
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
        setTestState({ ok: false, error: t("adm1.bk.pay.offline") });
      }
    });
  };

  return (
    <Card className="animate-rise p-4">
      <form ref={formRef} onSubmit={submitKeepingValues(action)} className="space-y-3">
        <input type="hidden" name="provider" value={provider} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="font-semibold">{label}</h3><p className="text-xs text-ink-3">{tOr(t, `adm1.bk.pay.hint.${provider}`, hint)}</p></div>
          <div className="shrink-0">{enabled ? <Badge tone="ok">{t("adm1.bk.pay.active")}</Badge> : configured ? <Badge>{t("adm1.bk.pay.setUp")}</Badge> : <Badge tone="outline">{t("adm1.bk.pay.notSetUp")}</Badge>}</div>
        </div>
        {fields.map((f) =>
          f.options ? (
            <Field key={f.key} label={tOr(t, `adm1.bk.pay.field.${provider}.${f.key}`, f.label)}>
              <Select name={f.key} defaultValue={values[f.key] && f.options.includes(values[f.key]!) ? values[f.key] : f.options[0]}>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            </Field>
          ) : (
            <Field key={f.key} label={tOr(t, `adm1.bk.pay.field.${provider}.${f.key}`, f.label)} hint={f.secret && configured ? t("adm1.bk.pay.keepSecret") : f.hint ? tOr(t, `adm1.bk.pay.fieldHint.${provider}.${f.key}`, f.hint) : undefined}>
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
            {t("adm1.bk.pay.webhook")} <code className="font-mono break-all">{appUrl}{hook}</code>
            {" "}{t(provider === "STRIPE" ? "adm1.bk.pay.webhookStripe" : "adm1.bk.pay.webhookPayrexx")} {t("adm1.bk.pay.webhookNone")}
          </p>
        ) : null}
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="enabled" defaultChecked={enabled} className="h-5 w-5 accent-[var(--ink)]" />
          <span className="text-sm font-medium">{t("adm1.bk.pay.enabled")}</span>
        </label>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        {testState && !testState.ok ? <Alert>{testState.error}</Alert> : testState?.ok && testState.message ? <Alert tone="ok">{testState.message}</Alert> : null}
        <div className="flex flex-wrap gap-2">
          <SubmitButton pending={pending} variant="secondary" className="min-h-11">{t("adm1.common.save")}</SubmitButton>
          {testable ? (
            <Button type="button" variant="ghost" className="min-h-11" disabled={testing} onClick={runTest}>
              <PlugZap className="h-4 w-4" aria-hidden /> {t(testing ? "adm1.bk.pay.testing" : "adm1.bk.pay.test")}
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
