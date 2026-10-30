"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card, Field, Input, Textarea } from "@/components/ui";
import { Segmented } from "@/components/ui/controls";
import { SubmitButton } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { reportIncidentAction } from "@/modules/range/actions";
import { INCIDENT_HINT, INCIDENT_KINDS, INCIDENT_SEVERITIES, newClientId } from "@/modules/range/types";

export function IncidentForm({ defaultDate, defaultTime, defaultLocation }: { defaultDate: string; defaultTime: string; defaultLocation: string }) {
  const [state, action, pending] = useActionState(reportIncidentAction, null);
  const cid = useRef<string | null>(null);
  const router = useRouter();
  const err = state && !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state?.ok && state.data) {
      toast.success(state.message ?? "Meldung erfasst.");
      router.push(`/range/incidents/${state.data.id}`);
    }
  }, [state, router]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    cid.current ??= newClientId();
    fd.set("clientId", cid.current);
    startTransition(() => action(fd));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Alert tone="warn">{INCIDENT_HINT}</Alert>
      <Card className="space-y-4 p-4">
        <Field label="Art">
          <Segmented name="kind" label="Art des Vorfalls" defaultValue="NEAR_MISS" options={INCIDENT_KINDS.map((k) => ({ value: k.key, label: k.label }))} />
        </Field>
        <Field label="Schwere">
          <Segmented name="severity" label="Schwere" defaultValue="LOW" options={INCIDENT_SEVERITIES.map((s) => ({ value: s.key, label: s.label }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum" error={err?.date}><Input type="date" name="date" defaultValue={defaultDate} required /></Field>
          <Field label="Zeit" error={err?.time}><Input type="time" name="time" defaultValue={defaultTime} required /></Field>
        </div>
        <Field label="Ort" hint="z.B. Scheibe 4, 300-m-Stand, Zeigergraben" error={err?.location}><Input name="location" defaultValue={defaultLocation} maxLength={191} /></Field>
        <Field label="Was ist passiert?" error={err?.description}><Textarea name="description" required minLength={5} maxLength={10000} rows={5} /></Field>
        <Field label="Beteiligte Personen (optional)" hint="Namen und Rolle, z.B. Schütze, Standdienst, Zeuge." error={err?.persons}><Textarea name="persons" maxLength={5000} rows={2} /></Field>
        <Field label="Sofortmassnahmen (optional)" hint="z.B. Erste Hilfe, Stand gesperrt, Waffe sichergestellt." error={err?.measures}><Textarea name="measures" maxLength={5000} rows={2} /></Field>
      </Card>
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} size="lg" className="h-14 w-full">Meldung absenden</SubmitButton>
    </form>
  );
}
