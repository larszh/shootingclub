"use client";

import { useActionState } from "react";
import { Alert, Card, Field, Input, Textarea } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveAmmoSettingsAction } from "@/modules/ammo/actions";
import type { AmmoSettingsView } from "@/modules/ammo/types";
import { useT } from "@/components/locale";

export function AmmoSettingsForm({ settings }: { settings: AmmoSettingsView }) {
  const [state, action, pending] = useActionState(saveAmmoSettingsAction, null);
  const t = useT();
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      <Card className="animate-rise space-y-4 p-4">
        <h2 className="font-semibold">{t("adm1.ammo.set.issueTitle")}</h2>
        <Switch name="onSiteOnly" defaultChecked={settings.onSiteOnly} label={t("adm1.ammo.set.onSite")} description={t("adm1.ammo.set.onSiteHint")} />
        <Switch name="requireIdCheck" defaultChecked={settings.requireIdCheck} label={t("adm1.ammo.set.idCheck")} description={t("adm1.ammo.set.idCheckHint")} />
        <Switch name="approvalRequired" defaultChecked={settings.approvalRequired} label={t("adm1.ammo.set.approval")} description={t("adm1.ammo.set.approvalHint")} />
        <Field label={t("adm1.ammo.set.max")} hint={t("adm1.ammo.set.maxHint")}>
          <Input name="maxRoundsPerOrder" inputMode="numeric" defaultValue={settings.maxRoundsPerOrder ?? ""} placeholder={t("adm1.ammo.set.maxPlaceholder")} />
        </Field>
      </Card>
      <Card className="animate-rise space-y-4 p-4">
        <h2 className="font-semibold">{t("adm1.ammo.set.invoiceTitle")}</h2>
        <p className="text-sm text-ink-3">{t("adm1.ammo.set.invoiceText")}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("adm1.ammo.set.prefix")} hint={t("adm1.ammo.set.prefixHint")}>
            <Input name="invoicePrefix" defaultValue={settings.invoicePrefix} maxLength={10} required />
          </Field>
          <Field label={t("adm1.ammo.set.dueDays")}>
            <Input name="invoiceDueDays" inputMode="numeric" defaultValue={settings.invoiceDueDays} required />
          </Field>
        </div>
      </Card>
      <Card className="animate-rise space-y-4 p-4">
        <Field label={t("adm1.ammo.set.note")} hint={t("adm1.ammo.set.noteHint")}>
          <Textarea name="note" defaultValue={settings.note ?? ""} maxLength={2000} rows={4} />
        </Field>
      </Card>
      {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <SubmitButton pending={pending} className="w-full sm:w-auto">{t("adm1.common.save")}</SubmitButton>
    </form>
  );
}
