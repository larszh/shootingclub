"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Save, Search } from "lucide-react";
import { Alert, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveCourseAction } from "@/modules/courses/actions";
import { COURSE_KINDS, COURSE_STATUSES, courseKindLabel, courseKindText, courseStatusInfo, DEFAULT_MIN_PARTICIPANTS, isCourseKind, type CourseKind } from "@/modules/courses/types";
import { useT } from "@/components/locale";

export type CourseFormValues = {
  id?: string;
  name: string;
  kind: string;
  year: number;
  startsOn: string | null;
  endsOn: string | null;
  leaderUserId: string | null;
  minParticipants: number | null;
  requiredProgramIds: string[];
  notes: string | null;
  status: string;
};

type ProgramOpt = { id: string; name: string; discipline: string; officialKind: string | null };
type LeaderOpt = { userId: string; name: string; trainer: boolean };

/** Kurs erfassen bzw. bearbeiten (courses.manage). */
export function CourseForm({ initial, programs, leaders, defaultYear }: { initial?: CourseFormValues; programs: ProgramOpt[]; leaders: LeaderOpt[]; defaultYear: number }) {
  const router = useRouter();
  const t = useT();
  const [state, action, pending] = useActionState(saveCourseAction, null);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  const [kind, setKind] = useState<CourseKind>(initial && isCourseKind(initial.kind) ? initial.kind : "JUNGSCHUETZEN");
  const [minP, setMinP] = useState<string>(initial ? (initial.minParticipants?.toString() ?? "") : String(DEFAULT_MIN_PARTICIPANTS.JUNGSCHUETZEN ?? ""));
  const [minTouched, setMinTouched] = useState(!!initial);
  const [selected, setSelected] = useState<string[]>(initial?.requiredProgramIds ?? []);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (state?.ok && state.data?.id) router.push(`/courses/${state.data.id}`);
  }, [state, router]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? programs.filter((p) => p.name.toLowerCase().includes(needle)) : programs;
    // Gewählte zuerst
    return [...list].sort((a, b) => Number(selected.includes(b.id)) - Number(selected.includes(a.id)));
  }, [programs, q, selected]);

  function changeKind(k: CourseKind) {
    setKind(k);
    if (!minTouched) setMinP(DEFAULT_MIN_PARTICIPANTS[k]?.toString() ?? "");
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }


  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Card className="animate-rise space-y-3 p-4">
        <Field label={t("adm2.courses.form.kind")} error={err?.kind}>
          <Select name="kind" value={kind} onChange={(e) => isCourseKind(e.target.value) && changeKind(e.target.value)}>
            {COURSE_KINDS.map((k) => <option key={k} value={k}>{courseKindLabel(k, t)}</option>)}
          </Select>
        </Field>
        <div className="flex gap-2 rounded-control bg-surface-2 p-3 text-sm text-ink-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          <div>
            <p>{courseKindText(kind, t)}</p>
            {kind === "JUNGSCHUETZEN" || kind === "JS" ? (
              <p className="mt-1 text-xs text-ink-3">{t("adm2.courses.form.jsHint")} {t("adm2.common.checkHint")}</p>
            ) : null}
          </div>
        </div>
        <Field label={t("adm2.courses.form.name")} error={err?.name}>
          <Input name="name" defaultValue={initial?.name ?? ""} required maxLength={191} placeholder={kind === "JUNGSCHUETZEN" ? t("adm2.courses.form.namePhJS") : t("adm2.courses.form.namePh")} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("adm2.common.year")} error={err?.year}><Input name="year" inputMode="numeric" defaultValue={initial?.year ?? defaultYear} required /></Field>
          <Field label={t("adm2.common.start")} error={err?.startsOn}><Input type="date" name="startsOn" defaultValue={initial?.startsOn ?? ""} /></Field>
          <Field label={t("adm2.common.end")} error={err?.endsOn}><Input type="date" name="endsOn" defaultValue={initial?.endsOn ?? ""} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("adm2.courses.form.leader")} error={err?.leaderUserId}>
            <Select name="leaderUserId" defaultValue={initial?.leaderUserId ?? ""}>
              <option value="">{t("adm2.courses.form.open")}</option>
              {leaders.map((l) => <option key={l.userId} value={l.userId}>{l.name}{l.trainer ? "" : t("adm2.courses.form.memberSuffix")}</option>)}
            </Select>
          </Field>
          <Field label={t("adm2.courses.form.min")} hint={DEFAULT_MIN_PARTICIPANTS[kind] ? t("adm2.courses.form.minSuggest", { n: DEFAULT_MIN_PARTICIPANTS[kind] ?? 0 }) : t("adm2.courses.form.minNone")} error={err?.minParticipants}>
            <Input name="minParticipants" inputMode="numeric" value={minP} onChange={(e) => { setMinP(e.target.value); setMinTouched(true); }} />
          </Field>
        </div>
        {initial?.id ? (
          <Field label={t("adm2.common.status")}>
            <Select name="status" defaultValue={initial.status}>
              {COURSE_STATUSES.map((s) => <option key={s} value={s}>{courseStatusInfo(s, t).label}</option>)}
            </Select>
          </Field>
        ) : null}
      </Card>

      <Card className="animate-rise space-y-3 p-4">
        <div>
          <h2 className="font-semibold">{t("adm2.courses.form.required")}</h2>
          <p className="text-sm text-ink-3">{t("adm2.courses.form.requiredText")}{selected.length ? t("adm2.courses.form.selected", { n: selected.length }) : t("adm2.courses.form.noneSelected")}</p>
        </div>
        {programs.length > 8 ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("adm2.courses.form.searchProgram")} aria-label={t("adm2.courses.form.searchProgram")} className="pl-9" />
          </div>
        ) : null}
        <div className="max-h-80 divide-y divide-line overflow-y-auto rounded-control border border-line">
          {filtered.length === 0 ? <p className="p-3 text-sm text-ink-3">{t("adm2.courses.form.noPrograms")}</p> : null}
          {filtered.map((p) => (
            <label key={p.id} className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-2">
              <input type="checkbox" name="programIds" value={p.id} checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="h-5 w-5 shrink-0 accent-[var(--accent)]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{p.name}</span>
                {p.officialKind ? <span className="text-xs text-ink-3">{t("adm2.courses.form.official", { kind: p.officialKind })}</span> : null}
              </span>
            </label>
          ))}
        </div>
        {/* Gewählte, aber durch die Suche ausgeblendete Programme trotzdem mitsenden */}
        {selected.filter((id) => !filtered.some((p) => p.id === id)).map((id) => <input key={id} type="hidden" name="programIds" value={id} />)}
      </Card>

      <Card className="animate-rise space-y-3 p-4">
        <Field label={t("adm2.common.notes")} hint={t("adm2.courses.form.notesHint")} error={err?.notes}>
          <Textarea name="notes" defaultValue={initial?.notes ?? ""} rows={3} maxLength={5000} />
        </Field>
      </Card>

      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} className="w-full sm:w-auto"><Save className="h-4 w-4" /> {initial?.id ? t("adm2.common.save") : t("adm2.courses.form.create")}</SubmitButton>
    </form>
  );
}
