"use client";

import { useActionState, useState } from "react";
import { PAYMENT_PROVIDERS, providerFees, type PaymentProviderKey } from "@/lib/payments/catalog";
import { Alert, Badge, Card, Field, Select } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveOnlineFeeProviderAction } from "./actions";
import { useT } from "@/components/locale";

export function OnlineFeeProviderForm({ current, enabledProviders, setupHref }: { current: string; enabledProviders: PaymentProviderKey[]; setupHref: string | null }) {
  const t = useT();
  const [state, action, pending] = useActionState(saveOnlineFeeProviderAction, null);
  const [value, setValue] = useState(current);
  const fees = providerFees(value);
  return (
    <Card className="animate-rise p-4">
      <form onSubmit={submitKeepingValues(action)} className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">{t("adm1.online.title")}</h3>
          {current !== "NONE" ? <Badge tone="ok">{t("adm1.online.on")}</Badge> : <Badge tone="outline">{t("adm1.online.off")}</Badge>}
        </div>
        <p className="text-xs text-ink-3">
          {t("adm1.online.explain")}
        </p>
        <Field label={t("adm1.online.provider")}>
          <Select name="onlineFeeProvider" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="NONE">{t("adm1.online.none")}</option>
            {PAYMENT_PROVIDERS.map((p) => {
              const on = enabledProviders.includes(p.key);
              return <option key={p.key} value={p.key} disabled={!on}>{p.label}{on ? "" : ` ${t("adm1.online.notSetUp")}`}</option>;
            })}
          </Select>
        </Field>
        {fees ? (
          <Alert tone="info" title={t("adm1.online.fees")}>
            {fees} {t("adm1.online.feesNote")}
          </Alert>
        ) : null}
        {!enabledProviders.length ? (
          <p className="text-xs text-ink-3">
            {t("adm1.online.noneSetUp")}{" "}
            {setupHref ? <a href={setupHref} className="underline">{t("adm1.online.setUpNow")}</a> : t("adm1.online.setUpBelow")}
          </p>
        ) : null}
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton pending={pending} variant="secondary" className="min-h-11">{t("adm1.common.save")}</SubmitButton>
      </form>
    </Card>
  );
}
