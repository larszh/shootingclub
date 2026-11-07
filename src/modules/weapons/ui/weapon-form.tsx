"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Alert, Card, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveWeaponAction } from "@/modules/weapons/actions";
import { disciplineSuggestions } from "@/modules/weapons/types";
import { useT } from "@/components/locale";

export type WeaponFormValues = {
  id?: string; name: string; discipline: string | null; manufacturer: string | null; model: string | null; caliber: string | null;
  serialNumber: string | null; shotCount: number; serviceEveryShots: number | null; nextServiceAt: string | null; notes: string | null;
  /** Status der Waffe (nur beim Bearbeiten); bei «Gesperrt» ist der Sperrgrund bearbeitbar */
  status?: string; blockReason?: string | null;
};

/** Waffe erfassen bzw. bearbeiten (nur «weapons.manage»). */
export function WeaponForm({ initial, disciplines, defaultServiceEveryShots }: { initial?: WeaponFormValues; disciplines: string[]; /** Standard aus den Einstellungen (nur für neue Waffen) */ defaultServiceEveryShots?: number | null }) {
  const router = useRouter();
  const t = useT();
  const [state, action, pending] = useActionState(saveWeaponAction, null);
  const listId = useId();
  const err = state && !state.ok ? state.fieldErrors : undefined;
  const options = [...new Set([...disciplineSuggestions(t), ...disciplines])];

  useEffect(() => {
    if (state?.ok && state.data?.id) router.push(`/weapons/${state.data.id}`);
  }, [state, router]);

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Card className="animate-rise space-y-3 p-4">
        <Field label={t("adm2.weapons.form.name")} error={err?.name}><Input name="name" defaultValue={initial?.name ?? ""} required maxLength={191} placeholder={t("adm2.weapons.form.namePh")} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("adm2.weapons.form.discipline")} error={err?.discipline}><Input name="discipline" list={listId} defaultValue={initial?.discipline ?? ""} maxLength={191} /></Field>
          <Field label={t("adm2.weapons.form.caliber")} error={err?.caliber}><Input name="caliber" defaultValue={initial?.caliber ?? ""} maxLength={191} placeholder={t("adm2.weapons.form.caliberPh")} /></Field>
          <Field label={t("adm2.weapons.form.manufacturer")} error={err?.manufacturer}><Input name="manufacturer" defaultValue={initial?.manufacturer ?? ""} maxLength={191} /></Field>
          <Field label={t("adm2.weapons.form.model")} error={err?.model}><Input name="model" defaultValue={initial?.model ?? ""} maxLength={191} /></Field>
        </div>
        <datalist id={listId}>{options.map((d) => <option key={d} value={d} />)}</datalist>
        <Field label={t("adm2.weapons.form.serial")} hint={t("adm2.weapons.form.serialHint")} error={err?.serialNumber}>
          <Input name="serialNumber" defaultValue={initial?.serialNumber ?? ""} maxLength={191} autoComplete="off" />
        </Field>
      </Card>
      <Card className="animate-rise space-y-3 p-4">
        <h2 className="font-semibold">{t("adm2.weapons.form.shotsService")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("adm2.weapons.form.shotCount")} hint={t("adm2.weapons.form.shotCountHint")} error={err?.shotCount}><Input name="shotCount" inputMode="numeric" defaultValue={initial?.shotCount ?? 0} /></Field>
          <Field label={t("adm2.weapons.form.every")} hint={t("adm2.weapons.form.everyHint")} error={err?.serviceEveryShots}><Input name="serviceEveryShots" inputMode="numeric" defaultValue={initial ? (initial.serviceEveryShots ?? "") : (defaultServiceEveryShots ?? "")} /></Field>
          <Field label={t("adm2.weapons.form.nextService")} hint={t("adm2.common.optional")} error={err?.nextServiceAt}><Input type="date" name="nextServiceAt" defaultValue={initial?.nextServiceAt ?? ""} /></Field>
        </div>
        <p className="text-xs text-ink-3">{t("adm2.weapons.intervalHint")} {t("adm2.common.checkHint")}</p>
        {initial?.status === "BLOCKED" ? (
          <Field label={t("adm2.weapons.form.blockReason")} hint={t("adm2.weapons.form.blockReasonHint")} error={err?.blockReason}>
            <Input name="blockReason" defaultValue={initial.blockReason ?? ""} required maxLength={191} />
          </Field>
        ) : null}
        <Field label={t("adm2.weapons.form.notes")} error={err?.notes}><Textarea name="notes" defaultValue={initial?.notes ?? ""} maxLength={5000} rows={3} /></Field>
      </Card>
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} className="w-full sm:w-auto"><Save className="h-4 w-4" /> {initial?.id ? t("adm2.common.save") : t("adm2.weapons.form.create")}</SubmitButton>
    </form>
  );
}
