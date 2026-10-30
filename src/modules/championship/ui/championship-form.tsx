"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveChampionshipAction } from "@/modules/championship/actions";
import { CATEGORY_EXAMPLE, CHAMPIONSHIP_RULES_HINT, maxCountInputError, parseCategories, parseDecimalInput, weightInputError } from "@/modules/championship/types";

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
  const catCheck = useMemo(() => parseCategories(categories), [categories]);

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
        <Field label="Name" error={err.name}>
          <Input name="name" defaultValue={values.name} maxLength={120} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Jahr" error={err.year}>
            <Input name="year" type="number" inputMode="numeric" min={2000} max={2100} value={year} onChange={(e) => changeYear(e.target.value)} required />
          </Field>
          <Field label="Beginn" error={err.startsOn}>
            <Input name="startsOn" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
          </Field>
          <Field label="Ende" error={err.endsOn}>
            <Input name="endsOn" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} required />
          </Field>
        </div>
        <Field label="Beste Resultate pro Programm" hint="Pro Programm zählen die besten N Resultate, die übrigen werden gestrichen. Leer = alle zählen." error={err.bestOf}>
          <Input name="bestOf" type="number" inputMode="numeric" min={1} max={100} defaultValue={values.bestOf ?? ""} placeholder="alle" />
        </Field>
        <Switch name="officialOnly" defaultChecked={values.officialOnly} label="Nur bestätigte Resultate" description="Es zählen nur Resultate, die der Schützenmeister als amtlich bestätigt hat." />
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold">Programme</h2>
        <p className="mt-1 text-sm text-ink-3">Pflichtprogramme muss man mindestens einmal geschossen haben, sonst gilt man als «nicht klassiert». Das Gewicht multipliziert die Punkte des Programms.</p>
        {err.programs ? <p className="mt-2 text-sm text-danger" role="alert">{err.programs}</p> : null}
        <ul className="mt-3 space-y-3">
          {selected.map((s) => {
            const p = byId.get(s.programId);
            return (
              <li key={s.programId} className="rounded-control border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{p?.name ?? "Unbekanntes Programm"}</div>
                    {p?.officialKind ? <Badge tone="accent" className="mt-1">amtlich</Badge> : null}
                  </div>
                  <button type="button" onClick={() => setSelected((l) => l.filter((x) => x.programId !== s.programId))} className="press -m-1 inline-flex h-11 items-center rounded-control px-3 text-sm text-danger hover:bg-danger/10">
                    Entfernen
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Field label="Gewicht" hint="1 = normal" error={weightInputError(s.weight) ?? undefined}>
                    <Input inputMode="decimal" value={s.weight} onChange={(e) => update(s.programId, { weight: e.target.value })} aria-label={`Gewicht ${p?.name ?? ""}`} />
                  </Field>
                  <Field label="Beste N" hint="leer = wie oben" error={maxCountInputError(s.maxCount) ?? undefined}>
                    <Input type="number" inputMode="numeric" min={1} max={100} value={s.maxCount} onChange={(e) => update(s.programId, { maxCount: e.target.value })} aria-label={`Anzahl ${p?.name ?? ""}`} />
                  </Field>
                </div>
                <Switch className="mt-3" checked={s.required} onChange={(v) => update(s.programId, { required: v })} label="Pflichtprogramm" />
              </li>
            );
          })}
        </ul>
        {available.length ? (
          <div className="mt-3 flex gap-2">
            <Select value={addId} onChange={(e) => setAddId(e.target.value)} aria-label="Programm hinzufügen" className="flex-1">
              <option value="">Programm wählen…</option>
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
              Hinzufügen
            </button>
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4 p-4">
        <Field label="Kategorien (optional)" hint="Eine pro Zeile: Name;minAlter;maxAlter;Bonuspunkte. Alter = Jahrgang (Alter am 31.12. des Jahres). Ohne Geburtsdatum → «ohne Kategorie»." error={err.categoriesText}>
          <Textarea name="categoriesText" rows={5} value={categories} onChange={(e) => setCategories(e.target.value)} placeholder={CATEGORY_EXAMPLE} className="font-mono text-sm" maxLength={5000} />
        </Field>
        {categories.trim() ? (
          catCheck.errors.length ? (
            <Alert tone="warn">{catCheck.errors.join(" ")}</Alert>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {catCheck.categories.map((c) => (
                <Badge key={c.name}>
                  {c.name}: {c.minAge ?? "0"}–{c.maxAge ?? "∞"} J.{c.bonus ? ` · +${c.bonus}` : ""}
                </Badge>
              ))}
            </div>
          )
        ) : null}
        <Field label="Reglement / Hinweise (optional)" hint="Wird bei der Rangliste angezeigt." error={err.rulesText}>
          <Textarea name="rulesText" rows={5} defaultValue={values.rulesText} maxLength={20000} />
        </Field>
        <p className="text-xs text-ink-3">{CHAMPIONSHIP_RULES_HINT}</p>
      </Card>

      {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok ? <Alert tone="ok">{state.message ?? "Gespeichert."}</Alert> : null}
      <SubmitButton pending={pending} className="h-12 w-full sm:w-auto" pendingText="Speichern…">
        {values.id ? "Speichern" : "Meisterschaft anlegen"}
      </SubmitButton>
    </form>
  );
}
