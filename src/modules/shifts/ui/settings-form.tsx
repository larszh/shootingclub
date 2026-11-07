"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Alert, Card, Field, Input } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { saveWorkSettingsAction } from "@/modules/shifts/actions";
import { useT } from "@/components/locale";

export function WorkSettingsForm({ initial, statusOptions }: { initial: { enabled: boolean; proRata: boolean; requiredHours: number; rate: string; statuses: string[] }; statusOptions: Array<{ value: string; label: string }> }) {
  const router = useRouter();
  const t = useT();
  const [state, action, pending] = useActionState(saveWorkSettingsAction, null);
  const err = state && !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? t("adm2.common.saved"));
    router.refresh();
  }, [state, router, t]);

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      <Card className="animate-rise space-y-4 p-4">
        <Switch name="enabled" defaultChecked={initial.enabled} label={t("adm2.shifts.set.enabled")} description={t("adm2.shifts.set.enabledHint")} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("adm2.shifts.set.required")} hint={t("adm2.shifts.set.requiredHint")} error={err?.requiredHours}>
            <Input name="requiredHours" inputMode="decimal" defaultValue={initial.requiredHours || ""} placeholder={t("adm2.shifts.set.requiredPh")} />
          </Field>
          <Field label={t("adm2.shifts.set.rate")} hint={t("adm2.shifts.set.rateHint")} error={err?.rate}>
            <Input name="rate" inputMode="decimal" defaultValue={initial.rate} placeholder={t("adm2.shifts.set.ratePh")} />
          </Field>
        </div>
        <Switch
          name="proRata"
          defaultChecked={initial.proRata}
          label={t("adm2.shifts.set.proRata")}
          description={t("adm2.shifts.set.proRataHint")}
        />
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-2">{t("adm2.shifts.set.statuses")}</legend>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {statusOptions.map((s) => (
              <label key={s.value} className="flex min-h-11 items-center gap-3 rounded-control px-2 hover:bg-surface-2">
                <input type="checkbox" name="statuses" value={s.value} defaultChecked={initial.statuses.includes(s.value)} className="h-5 w-5 accent-[var(--accent)]" />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
          {err?.statuses ? <p role="alert" className="mt-1 text-sm text-danger">{err.statuses}</p> : null}
          <p className="mt-1 text-xs text-ink-3">{t("adm2.shifts.set.exempt")}</p>
        </fieldset>
        <p className="text-xs text-ink-3">{t("adm2.shifts.set.footer")}</p>
      </Card>
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} className="w-full sm:w-auto"><Save className="h-4 w-4" /> {t("adm2.common.save")}</SubmitButton>
    </form>
  );
}
