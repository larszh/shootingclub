"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Alert, Card, Field, Input, Select } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveRuleAction } from "@/modules/courses/actions";
import { isProtectedQualKind } from "@/modules/courses/types";
import { QUALIFICATION_KINDS, qualificationLabel } from "@/modules/qualifications/types";
import { useT } from "@/components/locale";

export type RuleFormValues = {
  id?: string; programId: string; name: string; kind: string; passScore: number; maxZeros: number | null; validityMonths: number; requireInstructor: boolean; isActive: boolean;
};

type ProgramOpt = { id: string; name: string; passMinScore: number | null; passMaxZeros: number | null };

/** Regel für ein Qualifikationsschiessen (Programm, Mindestpunktzahl, Nuller, Gültigkeit). */
export function RuleForm({ initial, programs, allKinds }: { initial?: RuleFormValues; programs: ProgramOpt[]; allKinds: boolean }) {
  const router = useRouter();
  const t = useT();
  const [state, action, pending] = useActionState(saveRuleAction, null);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  const [programId, setProgramId] = useState(initial?.programId ?? "");
  const [passScore, setPassScore] = useState(initial ? String(initial.passScore) : "");
  const [maxZeros, setMaxZeros] = useState(initial?.maxZeros != null ? String(initial.maxZeros) : "");
  const [requireInstructor, setRequireInstructor] = useState(initial?.requireInstructor ?? true);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const kinds = allKinds ? QUALIFICATION_KINDS : QUALIFICATION_KINDS.filter((k) => !isProtectedQualKind(k.key));

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
        <Field label={t("adm2.courses.rule.name")} hint={t("adm2.courses.rule.nameHint")} error={err?.name}>
          <Input name="name" defaultValue={initial?.name ?? ""} required maxLength={191} />
        </Field>
        <Field label={t("adm2.courses.rule.program")} error={err?.programId}>
          <Select name="programId" value={programId} onChange={(e) => pickProgram(e.target.value)} required>
            <option value="">{t("adm2.courses.rule.chooseProgram")}</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field
          label={t("adm2.courses.rule.kind")}
          hint={allKinds ? t("adm2.courses.rule.kindHintAll") : t("adm2.courses.rule.kindHint")}
          error={err?.kind}
        >
          <Select name="kind" defaultValue={initial?.kind ?? "WEAPON_QUAL"}>
            {kinds.map((k) => <option key={k.key} value={k.key}>{qualificationLabel(k.key, t)}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label={t("adm2.courses.rule.passScore")} error={err?.passScore}><Input name="passScore" value={passScore} onChange={(e) => setPassScore(e.target.value)} inputMode="decimal" required /></Field>
          <Field label={t("adm2.courses.rule.maxZeros")} hint={t("adm2.courses.rule.maxZerosHint")} error={err?.maxZeros}><Input name="maxZeros" value={maxZeros} onChange={(e) => setMaxZeros(e.target.value)} inputMode="numeric" /></Field>
          <Field label={t("adm2.courses.rule.validity")} error={err?.validityMonths}><Input name="validityMonths" defaultValue={initial?.validityMonths ?? 12} inputMode="numeric" required /></Field>
        </div>
        <p className="text-xs text-ink-3">{t("adm2.courses.rule.limitsHint")}</p>
        <Switch label={t("adm2.courses.rule.instructor")} description={t("adm2.courses.rule.instructorHint")} checked={requireInstructor} onChange={setRequireInstructor} />
        {initial?.id ? <Switch label={t("adm2.courses.rule.active")} description={t("adm2.courses.rule.activeHint")} checked={isActive} onChange={setIsActive} /> : null}
      </Card>
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} className="w-full sm:w-auto"><Save className="h-4 w-4" /> {initial?.id ? t("adm2.common.save") : t("adm2.courses.rule.create")}</SubmitButton>
    </form>
  );
}
