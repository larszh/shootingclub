"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveChampionshipAction } from "@/modules/championship/actions";
import { CATEGORY_EXAMPLE, maxCountInputError, parseCategories, parseDecimalInput, weightInputError } from "@/modules/championship/types";
import { useT } from "@/components/locale";

type ProgramOption = { id: string; name: string; discipline: string; officialKind: string | null };
type Selected = { programId: string; required: boolean; weight: string; maxCount: string };

export type ChampionshipFormValues = {
  id?: string;
  name: string;
  year: number;
  startsOn: string;
  endsOn: string;
  bestOf: number | null;
  officialOnly: boolean;
  categoriesText: string;
  rulesText: string;
  programs: Array<{ programId: string; required: boolean; weight: number; maxCount: number | null }>;
};

export function ChampionshipForm({ values, programs }: { values: ChampionshipFormValues; programs: ProgramOption[] }) {
  const router = useRouter();
  const t = useT();
  const [state, action, pending] = useActionState(saveChampionshipAction, null);
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};
  const [selected, setSelected] = useState<Selected[]>(
    values.programs.map((p) => ({ programId: p.programId, required: p.required, weight: String(p.weight), maxCount: p.maxCount === null ? "" : String(p.maxCount) })),
  );
  const [addId, setAddId] = useState("");
  const [year, setYear] = useState(String(values.year));
  const [startsOn, setStartsOn] = useState(values.startsOn);
  const [endsOn, setEndsOn] = useState(values.endsOn);
  const [categories, setCategories] = useState(values.categoriesText);
  const catCheck = useMemo(() => parseCategories(categories, t), [categories, t]);

  useEffect(() => {
    if (state?.ok && state.data?.id && !values.id) router.push(`/championship/${state.data.id}`);
    else if (state?.ok && values.id) router.push(`/championship/${values.id}`);
  }, [state, values.id, router]);

  const byId = new Map(programs.map((p) => [p.id, p]));
  const available = programs.filter((p) => !selected.some((s) => s.programId === p.id));
  const serialized = JSON.stringify(
    selected.map((s) => ({
      programId: s.programId,
      required: s.required,
      // Ungültige Eingaben gehen als Text mit, damit der Server sie ablehnt (statt still 0 bzw. «unbegrenzt»).
      weight: s.weight.trim() === "" ? 1 : parseDecimalInput(s.weight) ?? s.weight,
      maxCount: s.maxCount.trim() === "" ? null : parseDecimalInput(s.maxCount) ?? s.maxCount,
    })),
  );

  function changeYear(v: string) {
    // Zeitraum mitziehen, solange er dem ganzen bisherigen Jahr entspricht.
    if (/^\d{4}$/.test(v) && startsOn === `${year}-01-01` && endsOn === `${year}-12-31`) {
      setStartsOn(`${v}-01-01`);
      setEndsOn(`${v}-12-31`);
    }
    setYear(v);
  }
  const update = (id: string, patch: Partial<Selected>) => setSelected((list) => list.map((s) => (s.programId === id ? { ...s, ...patch } : s)));

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-5">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <input type="hidden" name="programs" value={serialized} />

      <Card className="space-y-4 p-4">
        <Field label={t("adm2.common.name")} error={err.name}>
          <Input name="name" defaultValue={values.name} maxLength={120} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("adm2.common.year")} error={err.year}>
            <Input name="year" type="number" inputMode="numeric" min={2000} max={2100} value={year} onChange={(e) => changeYear(e.target.value)} required />
          </Field>
          <Field label={t("adm2.common.start")} error={err.startsOn}>
            <Input name="startsOn" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
          </Field>
          <Field label={t("adm2.common.end")} error={err.endsOn}>
            <Input name="endsOn" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} required />
          </Field>
        </div>
        <Field label={t("adm2.champ.form.bestOf")} hint={t("adm2.champ.form.bestOfHint")} error={err.bestOf}>
          <Input name="bestOf" type="number" inputMode="numeric" min={1} max={100} defaultValue={values.bestOf ?? ""} placeholder={t("adm2.champ.form.all")} />
        </Field>
        <Switch name="officialOnly" defaultChecked={values.officialOnly} label={t("adm2.champ.form.officialOnly")} description={t("adm2.champ.form.officialOnlyHint")} />
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold">{t("adm2.champ.form.programs")}</h2>
        <p className="mt-1 text-sm text-ink-3">{t("adm2.champ.form.programsHint")}</p>
        {err.programs ? <p className="mt-2 text-sm text-danger" role="alert">{err.programs}</p> : null}
        <ul className="mt-3 space-y-3">
          {selected.map((s) => {
            const p = byId.get(s.programId);
            return (
              <li key={s.programId} className="rounded-control border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{p?.name ?? t("adm2.champ.form.unknownProgram")}</div>
                    {p?.officialKind ? <Badge tone="accent" className="mt-1">{t("adm2.champ.form.official")}</Badge> : null}
                  </div>
                  <button type="button" onClick={() => setSelected((l) => l.filter((x) => x.programId !== s.programId))} className="press -m-1 inline-flex h-11 items-center rounded-control px-3 text-sm text-danger hover:bg-danger/10">
                    {t("adm2.common.remove")}
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Field label={t("adm2.champ.form.weight")} hint={t("adm2.champ.form.weightHint")} error={weightInputError(s.weight, t) ?? undefined}>
                    <Input inputMode="decimal" value={s.weight} onChange={(e) => update(s.programId, { weight: e.target.value })} aria-label={t("adm2.champ.form.weightAria", { name: p?.name ?? "" })} />
                  </Field>
                  <Field label={t("adm2.champ.form.bestN")} hint={t("adm2.champ.form.bestNHint")} error={maxCountInputError(s.maxCount, t) ?? undefined}>
                    <Input type="number" inputMode="numeric" min={1} max={100} value={s.maxCount} onChange={(e) => update(s.programId, { maxCount: e.target.value })} aria-label={t("adm2.champ.form.countAria", { name: p?.name ?? "" })} />
                  </Field>
                </div>
                <Switch className="mt-3" checked={s.required} onChange={(v) => update(s.programId, { required: v })} label={t("adm2.champ.form.required")} />
              </li>
            );
          })}
        </ul>
        {available.length ? (
          <div className="mt-3 flex gap-2">
            <Select value={addId} onChange={(e) => setAddId(e.target.value)} aria-label={t("adm2.champ.form.addProgram")} className="flex-1">
              <option value="">{t("adm2.champ.form.chooseProgram")}</option>
              {available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <button
              type="button"
              disabled={!addId}
              onClick={() => {
                if (!addId) return;
                setSelected((l) => [...l, { programId: addId, required: l.length === 0, weight: "1", maxCount: "" }]);
                setAddId("");
              }}
              className="press inline-flex h-11 shrink-0 items-center rounded-control border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
            >
              {t("adm2.common.add")}
            </button>
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4 p-4">
        <Field label={t("adm2.champ.form.categories")} hint={t("adm2.champ.form.categoriesHint")} error={err.categoriesText}>
          <Textarea name="categoriesText" rows={5} value={categories} onChange={(e) => setCategories(e.target.value)} placeholder={CATEGORY_EXAMPLE} className="font-mono text-sm" maxLength={5000} />
        </Field>
        {categories.trim() ? (
          catCheck.errors.length ? (
            <Alert tone="warn">{catCheck.errors.join(" ")}</Alert>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {catCheck.categories.map((c) => (
                <Badge key={c.name}>
                  {t("adm2.champ.form.catRange", { name: c.name, min: c.minAge ?? "0", max: c.maxAge ?? "∞" })}{c.bonus ? ` · +${c.bonus}` : ""}
                </Badge>
              ))}
            </div>
          )
        ) : null}
        <Field label={t("adm2.champ.form.rules")} hint={t("adm2.champ.form.rulesHint")} error={err.rulesText}>
          <Textarea name="rulesText" rows={5} defaultValue={values.rulesText} maxLength={20000} />
        </Field>
        <p className="text-xs text-ink-3">{t("adm2.champ.rulesHint")}</p>
      </Card>

      {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok ? <Alert tone="ok">{state.message ?? t("adm2.common.saved")}</Alert> : null}
      <SubmitButton pending={pending} className="h-12 w-full sm:w-auto" pendingText={t("adm2.champ.form.savingText")}>
        {values.id ? t("adm2.common.save") : t("adm2.champ.form.create")}
      </SubmitButton>
    </form>
  );
}
