"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Alert, Field, Input, Select } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveLiveBoardAction } from "@/modules/live/actions";

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
  const [state, action, pending] = useActionState(saveLiveBoardAction, null);
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};

  useEffect(() => {
    if (state?.ok && state.data?.id && !values.id) router.push(`/admin/live/${state.data.id}`);
  }, [state, values.id, router]);

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <Field label="Titel" hint="Gross oben auf dem Bildschirm, z.B. «Endschiessen 2026»" error={err.title}>
        <Input name="title" defaultValue={values.title} maxLength={120} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Programm" hint="Leer = alle Programme des Tages" error={err.programId}>
          <Select name="programId" defaultValue={values.programId}>
            <option value="">Alle Programme</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Anlass (optional)" hint="Nur Durchgänge, die zu diesem Anlass gehören" error={err.eventId}>
          <Select name="eventId" defaultValue={values.eventId}>
            <option value="">Kein Anlass</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tag" hint="Es erscheinen die Durchgänge dieses Tages" error={err.date}>
          <Input type="date" name="date" defaultValue={values.date} required />
        </Field>
        <Field label="Gültig bis" hint="Danach zeigt der Link nur noch eine Schlussmeldung" error={err.expiresAt}>
          <Input type="datetime-local" name="expiresAt" defaultValue={values.expiresAt} required />
        </Field>
      </div>
      <Switch name="showDecimals" defaultChecked={values.showDecimals} label="Zehntel anzeigen" description="Für Programme mit Zehntelwertung, z.B. 98.7" />
      {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && values.id ? <Alert tone="ok">{state.message ?? "Gespeichert."}</Alert> : null}
      <SubmitButton pending={pending} className="h-12 w-full sm:w-auto" pendingText="Speichern…">{values.id ? "Speichern" : "Live-Rangliste erstellen"}</SubmitButton>
    </form>
  );
}
