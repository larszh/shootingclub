"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Alert, Card, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveWeaponAction } from "@/modules/weapons/actions";
import { CHECK_HINT, DISCIPLINE_SUGGESTIONS } from "@/modules/weapons/types";

export type WeaponFormValues = {
  id?: string; name: string; discipline: string | null; manufacturer: string | null; model: string | null; caliber: string | null;
  serialNumber: string | null; shotCount: number; serviceEveryShots: number | null; nextServiceAt: string | null; notes: string | null;
};

/** Waffe erfassen bzw. bearbeiten (nur «weapons.manage»). */
export function WeaponForm({ initial, disciplines }: { initial?: WeaponFormValues; disciplines: string[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveWeaponAction, null);
  const listId = useId();
  const err = state && !state.ok ? state.fieldErrors : undefined;
  const options = [...new Set([...DISCIPLINE_SUGGESTIONS, ...disciplines])];

  useEffect(() => {
    if (state?.ok && state.data?.id) router.push(`/weapons/${state.data.id}`);
  }, [state, router]);

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Card className="animate-rise space-y-3 p-4">
        <Field label="Bezeichnung" error={err?.name}><Input name="name" defaultValue={initial?.name ?? ""} required maxLength={191} placeholder="z.B. Stgw 90 Nr. 3" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Disziplin" error={err?.discipline}><Input name="discipline" list={listId} defaultValue={initial?.discipline ?? ""} maxLength={191} /></Field>
          <Field label="Kaliber" error={err?.caliber}><Input name="caliber" defaultValue={initial?.caliber ?? ""} maxLength={191} placeholder="z.B. 5.6 mm" /></Field>
          <Field label="Hersteller" error={err?.manufacturer}><Input name="manufacturer" defaultValue={initial?.manufacturer ?? ""} maxLength={191} /></Field>
          <Field label="Modell" error={err?.model}><Input name="model" defaultValue={initial?.model ?? ""} maxLength={191} /></Field>
        </div>
        <datalist id={listId}>{options.map((d) => <option key={d} value={d} />)}</datalist>
        <Field label="Seriennummer" hint="Nur für Waffenverantwortliche sichtbar." error={err?.serialNumber}>
          <Input name="serialNumber" defaultValue={initial?.serialNumber ?? ""} maxLength={191} autoComplete="off" />
        </Field>
      </Card>
      <Card className="animate-rise space-y-3 p-4">
        <h2 className="font-semibold">Schusszähler und Wartung</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Schusszähler" hint="Wird bei jeder Rückgabe erhöht." error={err?.shotCount}><Input name="shotCount" inputMode="numeric" defaultValue={initial?.shotCount ?? 0} /></Field>
          <Field label="Wartung alle … Schuss" hint="Leer = kein Intervall" error={err?.serviceEveryShots}><Input name="serviceEveryShots" inputMode="numeric" defaultValue={initial?.serviceEveryShots ?? ""} /></Field>
          <Field label="Nächste Wartung am" hint="optional" error={err?.nextServiceAt}><Input type="date" name="nextServiceAt" defaultValue={initial?.nextServiceAt ?? ""} /></Field>
        </div>
        <p className="text-xs text-ink-3">Intervalle gemäss Hersteller bzw. Waffenkontrolle festlegen. {CHECK_HINT}</p>
        <Field label="Notizen" error={err?.notes}><Textarea name="notes" defaultValue={initial?.notes ?? ""} maxLength={5000} rows={3} /></Field>
      </Card>
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} className="w-full sm:w-auto"><Save className="h-4 w-4" /> {initial?.id ? "Speichern" : "Waffe erfassen"}</SubmitButton>
    </form>
  );
}
