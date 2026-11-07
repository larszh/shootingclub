"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Alert, Field, Input, Select } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveLiveBoardAction } from "@/modules/live/actions";
import { useT } from "@/components/locale";

export type LiveBoardFormValues = {
  id?: string;
  title: string;
  programId: string;
  eventId: string;
  date: string;
  showDecimals: boolean;
  /** "YYYY-MM-DDTHH:mm" (Schweizer Zeit) */
  expiresAt: string;
};

export function LiveBoardForm({ values, programs, events }: { values: LiveBoardFormValues; programs: Array<{ id: string; name: string }>; events: Array<{ id: string; title: string; label: string }> }) {
  const router = useRouter();
  const t = useT();
  const [state, action, pending] = useActionState(saveLiveBoardAction, null);
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};

  useEffect(() => {
    if (state?.ok && state.data?.id && !values.id) router.push(`/admin/live/${state.data.id}`);
  }, [state, values.id, router]);

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <Field label={t("adm2.live.f.title")} hint={t("adm2.live.f.titleHint")} error={err.title}>
        <Input name="title" defaultValue={values.title} maxLength={120} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("adm2.live.program")} hint={t("adm2.live.f.programHint")} error={err.programId}>
          <Select name="programId" defaultValue={values.programId}>
            <option value="">{t("adm2.live.f.allPrograms")}</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label={t("adm2.live.f.event")} hint={t("adm2.live.f.eventHint")} error={err.eventId}>
          <Select name="eventId" defaultValue={values.eventId}>
            <option value="">{t("adm2.live.f.noEvent")}</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("adm2.live.f.day")} hint={t("adm2.live.f.dayHint")} error={err.date}>
          <Input type="date" name="date" defaultValue={values.date} required />
        </Field>
        <Field label={t("adm2.live.f.until")} hint={t("adm2.live.f.untilHint")} error={err.expiresAt}>
          <Input type="datetime-local" name="expiresAt" defaultValue={values.expiresAt} required />
        </Field>
      </div>
      <Switch name="showDecimals" defaultChecked={values.showDecimals} label={t("adm2.live.f.decimals")} description={t("adm2.live.f.decimalsHint")} />
      {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && values.id ? <Alert tone="ok">{state.message ?? t("adm2.common.saved")}</Alert> : null}
      <SubmitButton pending={pending} className="h-12 w-full sm:w-auto" pendingText={t("adm2.live.f.saving")}>{values.id ? t("adm2.common.save") : t("adm2.live.f.create")}</SubmitButton>
    </form>
  );
}
