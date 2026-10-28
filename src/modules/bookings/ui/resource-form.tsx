"use client";

import { useActionState, useState } from "react";
import { saveResourceAction } from "@/modules/bookings/actions";
import { PERSONS_LIMIT, RESOURCE_KINDS, type DurationOption } from "@/modules/bookings/types";
import { maxPersonsFor } from "@/modules/bookings/pricing";
import type { ResourceView } from "@/modules/bookings/queries";
import { Alert, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { DurationEditor, clampPersons, serializeRows, toRows } from "./settings-form";

export type ResourceFormTenant = { durationOptions: DurationOption[]; currency: string; personPricing: boolean; maxPersons: number; flatExclusive: boolean; capacityPerPerson: boolean };

export function ResourceForm({ initial, tenant }: { initial?: ResourceView; tenant: ResourceFormTenant }) {
  const [state, action, pending] = useActionState(saveResourceAction, null);
  const [own, setOwn] = useState(!!initial?.durationOptions);
  const [durations, setDurations] = useState(toRows(initial?.durationOptions ?? tenant.durationOptions));
  const [capacityText, setCapacityText] = useState(String(initial?.capacity ?? 1));
  const [maxPersonsText, setMaxPersonsText] = useState(initial?.maxPersons ? String(initial.maxPersons) : "");
  const capacity = Math.max(1, Math.floor(Number(capacityText)) || 1);
  const override = maxPersonsText.trim() ? clampPersons(maxPersonsText, tenant.maxPersons) : null;
  const effectiveMax = maxPersonsFor({ capacity, maxPersons: override }, tenant);
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-5">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="durationsJson" value={serializeRows(durations)} />
      <Card className="animate-rise p-4 space-y-4">
        <Field label="Name"><Input name="name" defaultValue={initial?.name} required maxLength={80} placeholder="z.B. 25 m Stand, Bahn 3, Indoor-Raum" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Art"><Select name="kind" defaultValue={initial?.kind ?? "LANE"}>{RESOURCE_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</Select></Field>
          <Field label="Plätze gleichzeitig" hint={tenant.capacityPerPerson ? "Jede Person belegt einen Platz" : "z.B. 4 Scheiben = 4 Buchungen parallel"}><Input name="capacity" type="number" inputMode="numeric" min={1} max={200} value={capacityText} onChange={(e) => setCapacityText(e.target.value)} /></Field>
        </div>
        <Field label="Höchstens Personen pro Buchung (optional)" hint={`Leer = Vereinsstandard (${tenant.maxPersons}). Gilt hier: ${effectiveMax}${tenant.capacityPerPerson && capacity < (override ?? tenant.maxPersons) ? " (begrenzt durch die Plätze)" : ""}.`}>
          <Input name="maxPersons" type="number" inputMode="numeric" min={1} max={PERSONS_LIMIT} value={maxPersonsText} placeholder={String(tenant.maxPersons)} onChange={(e) => setMaxPersonsText(e.target.value)} />
        </Field>
        <Field label="Beschreibung (optional)"><Textarea name="description" defaultValue={initial?.description ?? ""} maxLength={400} className="min-h-16" placeholder="Distanz, Waffenarten, Besonderheiten" /></Field>
        <label className="flex items-center gap-3"><input type="checkbox" name="isActive" value="on" defaultChecked={initial?.isActive ?? true} className="h-5 w-5 accent-[var(--ink)]" /><span className="text-sm font-medium">Buchbar</span></label>
        <input type="hidden" name="isActive" value="off" />
      </Card>
      <Card className="animate-rise p-4 space-y-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="ownDurations" checked={own} onChange={(e) => setOwn(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--ink)]" />
          <span><span className="block text-sm font-medium">Eigene Dauer und Preise für diese Ressource</span><span className="block text-xs text-ink-3">Sonst gelten die allgemeinen Einstellungen des Vereins{tenant.personPricing ? " inkl. Preistabelle pro Person" : ""}.</span></span>
        </label>
        {own ? <DurationEditor value={durations} onChange={setDurations} currency={tenant.currency} personPricing={tenant.personPricing} maxPersons={effectiveMax} /> : null}
      </Card>
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} size="lg" className="w-full">{initial ? "Speichern" : "Ressource anlegen"}</SubmitButton>
    </form>
  );
}
