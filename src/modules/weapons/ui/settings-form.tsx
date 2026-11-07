"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { saveWeaponSettingsAction } from "@/modules/weapons/actions";
import { CHECK_HINT, DEFAULT_MINOR_REPORT_DAYS, MINOR_HINT } from "@/modules/weapons/types";

/** Einstellungen Vereinswaffen: Meldefrist Minderjährige und Standard-Wartungsintervall (nur «weapons.manage»). */
export function WeaponSettingsForm({ initial }: { initial: { minorReportDays: number; serviceEveryShotsDefault: number | null; saved: boolean } }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveWeaponSettingsAction, null);
  const err = state && !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? "Gespeichert.");
    router.refresh();
  }, [state, router]);

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      <Card className="animate-rise space-y-3 p-4">
        <h2 className="font-semibold">Abgabe an Minderjährige</h2>
        <Field label="Meldefrist (Tage)" hint={`Ab der Ausleihe. Vorschlag im Ausleihdialog, pro Ausleihe änderbar. Standard: ${DEFAULT_MINOR_REPORT_DAYS} Tage.`} error={err?.minorReportDays}>
          <Input name="minorReportDays" inputMode="numeric" defaultValue={initial.minorReportDays} className="w-32" />
        </Field>
        <p className="text-xs text-ink-3">{MINOR_HINT}</p>
      </Card>
      <Card className="animate-rise space-y-3 p-4">
        <h2 className="font-semibold">Wartung</h2>
        <Field label="Standard: Wartung alle … Schuss" hint="Wird bei neu erfassten Waffen vorgeschlagen. Leer = kein Vorschlag. Bestehende Waffen bleiben unverändert." error={err?.serviceEveryShotsDefault}>
          <Input name="serviceEveryShotsDefault" inputMode="numeric" defaultValue={initial.serviceEveryShotsDefault ?? ""} placeholder="z.B. 2000" className="w-40" />
        </Field>
        <p className="text-xs text-ink-3">Intervalle gemäss Hersteller bzw. Waffenkontrolle festlegen. {CHECK_HINT}</p>
      </Card>
      {!initial.saved ? <p className="text-xs text-ink-3">Noch nicht gespeichert: bis dahin gilt als Meldefrist die zuletzt verwendete bzw. der Standard.</p> : null}
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} className="w-full sm:w-auto"><Save className="h-4 w-4" /> Speichern</SubmitButton>
    </form>
  );
}
