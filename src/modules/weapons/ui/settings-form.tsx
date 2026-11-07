"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { saveWeaponSettingsAction } from "@/modules/weapons/actions";
import { DEFAULT_MINOR_REPORT_DAYS } from "@/modules/weapons/types";
import { useT } from "@/components/locale";

/** Einstellungen Vereinswaffen: Meldefrist Minderjährige und Standard-Wartungsintervall (nur «weapons.manage»). */
export function WeaponSettingsForm({ initial }: { initial: { minorReportDays: number; serviceEveryShotsDefault: number | null; saved: boolean } }) {
  const router = useRouter();
  const t = useT();
  const [state, action, pending] = useActionState(saveWeaponSettingsAction, null);
  const err = state && !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? t("adm2.common.saved"));
    router.refresh();
  }, [state, router, t]);

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      <Card className="animate-rise space-y-3 p-4">
        <h2 className="font-semibold">{t("adm2.weapons.settings.minors")}</h2>
        <Field label={t("adm2.weapons.settings.reportDays")} hint={t("adm2.weapons.settings.reportDaysHint", { n: DEFAULT_MINOR_REPORT_DAYS })} error={err?.minorReportDays}>
          <Input name="minorReportDays" inputMode="numeric" defaultValue={initial.minorReportDays} className="w-32" />
        </Field>
        <p className="text-xs text-ink-3">{t("adm2.weapons.minorHint")}</p>
      </Card>
      <Card className="animate-rise space-y-3 p-4">
        <h2 className="font-semibold">{t("adm2.weapons.settings.service")}</h2>
        <Field label={t("adm2.weapons.settings.every")} hint={t("adm2.weapons.settings.everyHint")} error={err?.serviceEveryShotsDefault}>
          <Input name="serviceEveryShotsDefault" inputMode="numeric" defaultValue={initial.serviceEveryShotsDefault ?? ""} placeholder={t("adm2.weapons.settings.everyPh")} className="w-40" />
        </Field>
        <p className="text-xs text-ink-3">{t("adm2.weapons.intervalHint")} {t("adm2.common.checkHint")}</p>
      </Card>
      {!initial.saved ? <p className="text-xs text-ink-3">{t("adm2.weapons.settings.notSaved")}</p> : null}
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} className="w-full sm:w-auto"><Save className="h-4 w-4" /> {t("adm2.common.save")}</SubmitButton>
    </form>
  );
}
