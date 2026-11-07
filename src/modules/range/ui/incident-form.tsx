"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card, Field, Input, Textarea } from "@/components/ui";
import { Segmented } from "@/components/ui/controls";
import { SubmitButton } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { reportIncidentAction } from "@/modules/range/actions";
import { INCIDENT_KINDS, INCIDENT_SEVERITIES, kindLabel, newClientId, severityInfo } from "@/modules/range/types";
import { getT, type Locale } from "@/lib/i18n/core";

export function IncidentForm({ defaultDate, defaultTime, defaultLocation, locale = "de" }: { defaultDate: string; defaultTime: string; defaultLocation: string; locale?: Locale }) {
  const t = useMemo(() => getT(locale), [locale]);
  const [state, action, pending] = useActionState(reportIncidentAction, null);
  const cid = useRef<string | null>(null);
  const router = useRouter();
  const err = state && !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state?.ok && state.data) {
      toast.success(state.message ?? t("shooting.incident.msg.reported"));
      router.push(`/range/incidents/${state.data.id}`);
    }
  }, [state, router, t]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    cid.current ??= newClientId();
    fd.set("clientId", cid.current);
    startTransition(() => action(fd));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Alert tone="warn">{t("shooting.incident.hint")}</Alert>
      <Card className="space-y-4 p-4">
        <Field label={t("shooting.incident.field.kind")}>
          <Segmented name="kind" label={t("shooting.incident.field.kindLabel")} defaultValue="NEAR_MISS" options={INCIDENT_KINDS.map((k) => ({ value: k.key, label: kindLabel(k.key, t) }))} />
        </Field>
        <Field label={t("shooting.incident.field.severity")}>
          <Segmented name="severity" label={t("shooting.incident.field.severity")} defaultValue="LOW" options={INCIDENT_SEVERITIES.map((s) => ({ value: s.key, label: severityInfo(s.key, t).label }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("shooting.incident.field.date")} error={err?.date}><Input type="date" name="date" defaultValue={defaultDate} required /></Field>
          <Field label={t("shooting.incident.field.time")} error={err?.time}><Input type="time" name="time" defaultValue={defaultTime} required /></Field>
        </div>
        <Field label={t("shooting.incident.field.location")} hint={t("shooting.incident.field.locationHint")} error={err?.location}><Input name="location" defaultValue={defaultLocation} maxLength={191} /></Field>
        <Field label={t("shooting.incident.field.description")} error={err?.description}><Textarea name="description" required minLength={5} maxLength={10000} rows={5} /></Field>
        <Field label={t("shooting.incident.field.persons")} hint={t("shooting.incident.field.personsHint")} error={err?.persons}><Textarea name="persons" maxLength={5000} rows={2} /></Field>
        <Field label={t("shooting.incident.field.measures")} hint={t("shooting.incident.field.measuresHint")} error={err?.measures}><Textarea name="measures" maxLength={5000} rows={2} /></Field>
      </Card>
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} size="lg" className="h-14 w-full">{t("shooting.incident.submit")}</SubmitButton>
    </form>
  );
}
