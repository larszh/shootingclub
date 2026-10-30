"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Alert, Card, Field, Input, Select } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveRuleAction } from "@/modules/courses/actions";
import { QUALIFICATION_KINDS } from "@/modules/qualifications/types";

export type RuleFormValues = {
  id?: string; programId: string; name: string; kind: string; passScore: number; maxZeros: number | null; validityMonths: number; requireInstructor: boolean; isActive: boolean;
};

type ProgramOpt = { id: string; name: string; passMinScore: number | null; passMaxZeros: number | null };

/** Regel für ein Qualifikationsschiessen (Programm, Mindestpunktzahl, Nuller, Gültigkeit). */
export function RuleForm({ initial, programs }: { initial?: RuleFormValues; programs: ProgramOpt[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveRuleAction, null);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  const [programId, setProgramId] = useState(initial?.programId ?? "");
  const [passScore, setPassScore] = useState(initial ? String(initial.passScore) : "");
  const [maxZeros, setMaxZeros] = useState(initial?.maxZeros != null ? String(initial.maxZeros) : "");
  const [requireInstructor, setRequireInstructor] = useState(initial?.requireInstructor ?? true);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  useEffect(() => {
    if (state?.ok && state.data?.id) router.push(`/courses/qualifications/${state.data.id}`);
  }, [state, router]);

  function pickProgram(id: string) {
    setProgramId(id);
    const p = programs.find((x) => x.id === id);
    // Grenzwerte aus dem Programm vorschlagen, wenn noch leer
    if (p?.passMinScore != null && !passScore) setPassScore(String(p.passMinScore));
    if (p?.passMaxZeros != null && !maxZeros) setMaxZeros(String(p.passMaxZeros));
  }

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="requireInstructor" value={requireInstructor ? "on" : ""} />
      <input type="hidden" name="isActive" value={isActive ? "on" : ""} />
      <Card className="animate-rise space-y-3 p-4">
        <Field label="Bezeichnung" hint="Erscheint auf dem Nachweis, z.B. «Pistole 25 m Einsatzqualifikation»." error={err?.name}>
          <Input name="name" defaultValue={initial?.name ?? ""} required maxLength={191} />
        </Field>
        <Field label="Programm" error={err?.programId}>
          <Select name="programId" value={programId} onChange={(e) => pickProgram(e.target.value)} required>
            <option value="">– Programm wählen –</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Art der Qualifikation" error={err?.kind}>
          <Select name="kind" defaultValue={initial?.kind ?? "WEAPON_QUAL"}>
            {QUALIFICATION_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Mindestpunktzahl" error={err?.passScore}><Input name="passScore" value={passScore} onChange={(e) => setPassScore(e.target.value)} inputMode="decimal" required /></Field>
          <Field label="Max. Nuller" hint="Leer = keine Grenze" error={err?.maxZeros}><Input name="maxZeros" value={maxZeros} onChange={(e) => setMaxZeros(e.target.value)} inputMode="numeric" /></Field>
          <Field label="Gültig (Monate)" error={err?.validityMonths}><Input name="validityMonths" defaultValue={initial?.validityMonths ?? 12} inputMode="numeric" required /></Field>
        </div>
        <p className="text-xs text-ink-3">Grenzwerte und Gültigkeit gemäss Vorgaben des Auftraggebers bzw. der zuständigen Stelle festlegen und regelmässig prüfen.</p>
        <Switch label="Ausbildner:in nötig" description="Erteilung nur durch die Kursleitung, nicht für sich selbst." checked={requireInstructor} onChange={setRequireInstructor} />
        {initial?.id ? <Switch label="Aktiv" description="Inaktive Regeln erlauben keine neuen Erteilungen." checked={isActive} onChange={setIsActive} /> : null}
      </Card>
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} className="w-full sm:w-auto"><Save className="h-4 w-4" /> {initial?.id ? "Speichern" : "Regel erstellen"}</SubmitButton>
    </form>
  );
}
