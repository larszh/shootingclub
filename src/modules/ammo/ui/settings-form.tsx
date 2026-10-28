"use client";

import { useActionState } from "react";
import { Alert, Card, Field, Input, Textarea } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveAmmoSettingsAction } from "@/modules/ammo/actions";
import type { AmmoSettingsView } from "@/modules/ammo/types";

export function AmmoSettingsForm({ settings }: { settings: AmmoSettingsView }) {
  const [state, action, pending] = useActionState(saveAmmoSettingsAction, null);
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      <Card className="animate-rise space-y-4 p-4">
        <h2 className="font-semibold">Abgabe</h2>
        <Switch name="onSiteOnly" defaultChecked={settings.onSiteOnly} label="Abgabe nur zum sofortigen Verbrauch auf dem Platz" description="Mitglieder sehen den Hinweis gross und bestätigen ihn bei jeder Bestellung." />
        <Switch name="requireIdCheck" defaultChecked={settings.requireIdCheck} label="Ausgabe nur nach Prüfung der Berechtigung" description="An der Ausgabe muss «Berechtigung geprüft» bestätigt werden, bevor die Munition abgegeben wird." />
        <Switch name="approvalRequired" defaultChecked={settings.approvalRequired} label="Bestellungen zuerst freigeben" description="Neue Bestellungen bleiben offen, bis ein Admin sie freigibt." />
        <Field label="Höchstmenge pro Bestellung (Schuss, optional)" hint="Leer lassen für kein Limit.">
          <Input name="maxRoundsPerOrder" inputMode="numeric" defaultValue={settings.maxRoundsPerOrder ?? ""} placeholder="z.B. 500" />
        </Field>
      </Card>
      <Card className="animate-rise space-y-4 p-4">
        <h2 className="font-semibold">Rechnung</h2>
        <p className="text-sm text-ink-3">Munition wird ausschliesslich auf Rechnung verkauft. Die Rechnung entsteht bei der Ausgabe, mit fortlaufender Nummer und QR-Zahlteil aus dem Rechnungsprofil.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nummern-Präfix" hint="z.B. MU- → MU-2026-0001">
            <Input name="invoicePrefix" defaultValue={settings.invoicePrefix} maxLength={10} required />
          </Field>
          <Field label="Zahlungsfrist (Tage)">
            <Input name="invoiceDueDays" inputMode="numeric" defaultValue={settings.invoiceDueDays} required />
          </Field>
        </div>
      </Card>
      <Card className="animate-rise space-y-4 p-4">
        <Field label="Hinweis für Mitglieder (optional)" hint="Erscheint im Munitionsshop, z.B. Abholzeiten oder was mitzubringen ist.">
          <Textarea name="note" defaultValue={settings.note ?? ""} maxLength={2000} rows={4} />
        </Field>
      </Card>
      {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <SubmitButton pending={pending} className="w-full sm:w-auto">Speichern</SubmitButton>
    </form>
  );
}
