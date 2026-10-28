"use client";

import { useActionState, useState } from "react";
import { saveResourceAction } from "@/modules/bookings/actions";
import { RESOURCE_KINDS, type DurationOption } from "@/modules/bookings/types";
import type { ResourceView } from "@/modules/bookings/queries";
import { Alert, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { DurationEditor, toRows } from "./settings-form";

export function ResourceForm({ initial, tenantDurations, currency }: { initial?: ResourceView; tenantDurations: DurationOption[]; currency: string }) {
  const [state, action, pending] = useActionState(saveResourceAction, null);
  const [own, setOwn] = useState(!!initial?.durationOptions);
  const [durations, setDurations] = useState(toRows(initial?.durationOptions ?? tenantDurations));
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-5">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="durationsJson" value={JSON.stringify(durations)} />
      <Card className="animate-rise p-4 space-y-4">
        <Field label="Name"><Input name="name" defaultValue={initial?.name} required placeholder="z.B. 25 m Stand, Bahn 3, Indoor-Raum" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Art"><Select name="kind" defaultValue={initial?.kind ?? "LANE"}>{RESOURCE_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</Select></Field>
          <Field label="Plätze gleichzeitig" hint="z.B. 4 Scheiben = 4 Buchungen parallel"><Input name="capacity" type="number" inputMode="numeric" min={1} defaultValue={initial?.capacity ?? 1} /></Field>
        </div>
        <Field label="Beschreibung (optional)"><Textarea name="description" defaultValue={initial?.description ?? ""} className="min-h-16" placeholder="Distanz, Waffenarten, Besonderheiten" /></Field>
        <label className="flex items-center gap-3"><input type="checkbox" name="isActive" value="on" defaultChecked={initial?.isActive ?? true} className="h-5 w-5 accent-[var(--ink)]" /><span className="text-sm font-medium">Buchbar</span></label>
        <input type="hidden" name="isActive" value="off" />
      </Card>
      <Card className="animate-rise p-4 space-y-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="ownDurations" checked={own} onChange={(e) => setOwn(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--ink)]" />
          <span><span className="block text-sm font-medium">Eigene Dauer und Preise für diese Ressource</span><span className="block text-xs text-ink-3">Sonst gelten die allgemeinen Einstellungen des Vereins.</span></span>
        </label>
        {own ? <DurationEditor value={durations} onChange={setDurations} currency={currency} /> : null}
      </Card>
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} size="lg" className="w-full">{initial ? "Speichern" : "Ressource anlegen"}</SubmitButton>
    </form>
  );
}
