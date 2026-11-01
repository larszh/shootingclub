"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Upload, UserRound, XCircle } from "lucide-react";
import { Alert, Badge, Button, Card, Input, LinkButton, Select, StatCard } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { isNavigationError, toast } from "@/lib/ui-feedback";
import { cn, formatDate, formatScore } from "@/lib/utils";
import type { Stage } from "@/modules/scores/types";
import {
  PRESET_DISCLAIMER,
  SCORE_FIELDS,
  SCORE_FIELD_LABELS,
  SCORE_IMPORT_MAX_BYTES,
  SCORE_PRESETS,
  SCORE_PRESET_IDS,
  MULTI_FIELDS,
  detectScorePreset,
  normalizeMapping,
  readScoreFile,
  suggestLayout,
  suggestScoreMapping,
  type ScoreField,
  type ScoreLayout,
  type ScorePresetId,
  type ScoreTable,
} from "@/modules/scores/import/parse";
import { buildShooters, parseAssignment, assignmentValue, SINGLE_SHOOTER_NAME } from "@/modules/scores/import/shooters";
import { matchAllMembers, type MemberMatch } from "@/modules/scores/import/fuzzy";
import { planImport, type PlannedParticipant } from "@/modules/scores/import/plan";
import { checkScoreImportAction, commitScoreImportAction, type CommitScoreImportResult } from "@/modules/scores/import/actions";
import type { PreviousImport } from "@/modules/scores/import/queries";

export type ImportProgramOption = { id: string; name: string; scoringMode: string; stages: Stage[]; max: number; scope: "global" | "tenant" };
export type ImportMemberOption = { id: string; name: string };

type Step = "upload" | "map" | "assign" | "done";
const STEPS: Array<{ id: Step; label: string }> = [
  { id: "upload", label: "Datei" },
  { id: "map", label: "Spalten" },
  { id: "assign", label: "Zuordnen" },
  { id: "done", label: "Fertig" },
];
const SHOW_STEP = 60;

async function sha256Hex(bytes: Uint8Array): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const buf = await globalThis.crypto.subtle.digest("SHA-256", bytes.slice().buffer);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

export function ScoreImportWizard({ programs, members, today }: { programs: ImportProgramOption[]; members: ImportMemberOption[]; today: string }) {
  const [step, setStep] = useState<Step>("upload");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<ScorePresetId>("generic");
  const [table, setTable] = useState<ScoreTable | null>(null);
  const [mapping, setMapping] = useState<ScoreField[]>([]);
  const [layout, setLayout] = useState<ScoreLayout>("shots");
  const [discipline, setDiscipline] = useState<string | null>(null);
  const [programId, setProgramId] = useState("");
  const [date, setDate] = useState(today);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [previous, setPrevious] = useState<PreviousImport | null>(null);
  const [result, setResult] = useState<Extract<CommitScoreImportResult, { status: "created" }> | null>(null);

  const config = useMemo(() => ({ layout, mapping, discipline }), [layout, mapping, discipline]);

  const guard = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        if (isNavigationError(e)) throw e;
        setError("Das hat nicht geklappt. Bitte nochmals versuchen.");
      }
    });

  const applyPreset = (p: ScorePresetId, t: ScoreTable) => {
    const m = suggestScoreMapping(t.headers, p);
    const l = suggestLayout(m, p);
    setPreset(p);
    setMapping(m);
    setLayout(l);
    // Mehrere Disziplinen in der Datei: häufigste vorwählen (ein Import = ein Durchgang mit einem Programm)
    const disciplines = buildShooters(t, normalizeMapping(m, t.headers.length), l).disciplines;
    setDiscipline(disciplines.length > 1 ? disciplines[0]! : null);
  };

  const readFile = () => guard(async () => {
    if (!file) return;
    setPrevious(null);
    if (file.size > SCORE_IMPORT_MAX_BYTES) {
      setError("Die Datei ist grösser als 5 MB. Bitte in mehrere Dateien aufteilen.");
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let t: ScoreTable;
    try {
      t = readScoreFile(bytes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die Datei konnte nicht gelesen werden.");
      return;
    }
    const hash = await sha256Hex(bytes);
    if (hash) {
      const res = await checkScoreImportAction(hash);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data?.previous) {
        setPrevious(res.data.previous);
        return;
      }
    }
    setTable(t);
    // Vorlage «Allgemein» gewählt, Datei sieht aber nach einem bekannten Export aus → Vorschlag übernehmen
    const detected = detectScorePreset(t.headers);
    const p = preset === "generic" && detected !== "generic" ? detected : preset;
    if (p !== preset) toast(`Vorlage «${SCORE_PRESETS[p].label}» erkannt`);
    applyPreset(p, t);
    setAssignments({});
    setStep("map");
  });

  const commit = (plan: ReturnType<typeof planImport>) => guard(async () => {
    if (!file || !table) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set(
      "config",
      JSON.stringify({
        preset,
        layout,
        mapping,
        discipline,
        programId,
        date,
        assignments: Object.fromEntries(plan.participants.map((p) => [p.shooter.key, assignmentValue(p.assignment)])),
      }),
    );
    const res = await commitScoreImportAction(fd);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.data!.status === "duplicate") {
      setPrevious(res.data!.previous);
      setStep("upload");
      return;
    }
    setResult(res.data!);
    setStep("done");
    toast.success("Resultate importiert");
  });

  const restart = () => {
    setStep("upload");
    setFile(null);
    setTable(null);
    setMapping([]);
    setAssignments({});
    setPrevious(null);
    setResult(null);
    setError(null);
    setProgramId("");
  };

  const idx = STEPS.findIndex((x) => x.id === step);
  return (
    <div>
      <ol className="mb-4 grid grid-cols-4 gap-1" aria-label="Schritte">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex flex-col items-center gap-1 text-xs" aria-current={s.id === step ? "step" : undefined}>
            <span className={cn("h-1.5 w-full rounded-full", i <= idx ? "bg-accent" : "bg-line")} />
            <span className={i === idx ? "font-semibold text-ink" : "text-ink-3"}>{i + 1}. {s.label}</span>
          </li>
        ))}
      </ol>

      {error ? <Alert className="mb-3">{error}</Alert> : null}
      {previous ? <DuplicateNotice previous={previous} /> : null}

      {step === "upload" ? (
        <UploadStep file={file} onFile={(f) => { setFile(f); setPrevious(null); }} preset={preset} onPreset={setPreset} onNext={readFile} pending={pending} />
      ) : null}

      {step === "map" && table ? (
        <MapStep
          table={table}
          fileName={file?.name ?? ""}
          preset={preset}
          onPreset={(p) => applyPreset(p, table)}
          mapping={mapping}
          onMapping={setMapping}
          layout={layout}
          onLayout={setLayout}
          discipline={discipline}
          onDiscipline={setDiscipline}
          onBack={() => setStep("upload")}
          onNext={(dates) => {
            if (dates[0]) setDate(dates[0]);
            setStep("assign");
          }}
        />
      ) : null}

      {step === "assign" && table ? (
        <AssignStep
          table={table}
          config={config}
          programs={programs}
          members={members}
          programId={programId}
          onProgram={setProgramId}
          date={date}
          onDate={setDate}
          assignments={assignments}
          onAssignments={setAssignments}
          onBack={() => setStep("map")}
          onCommit={commit}
          pending={pending}
        />
      ) : null}

      {step === "done" && result ? <DoneStep result={result} onRestart={restart} /> : null}
    </div>
  );
}

function DuplicateNotice({ previous }: { previous: PreviousImport }) {
  return (
    <Alert tone="warn" title="Diese Datei wurde bereits importiert" className="mb-3">
      «{previous.fileName}» am {formatDate(previous.createdAt)}. Ein zweiter Import würde die Resultate doppelt erfassen.
      {previous.matches.length ? (
        <span className="mt-1 block">
          {previous.matches.map((m) => (
            <Link key={m.id} href={`/scores/matches/${m.id}`} className="mr-3 underline">{m.title ?? "Durchgang"} ({formatDate(m.date)})</Link>
          ))}
        </span>
      ) : (
        <span className="mt-1 block">Der damals erstellte Durchgang wurde inzwischen gelöscht.</span>
      )}
    </Alert>
  );
}

function UploadStep({ file, onFile, preset, onPreset, onNext, pending }: { file: File | null; onFile: (f: File | null) => void; preset: ScorePresetId; onPreset: (p: ScorePresetId) => void; onNext: () => void; pending: boolean }) {
  return (
    <div className="space-y-3">
      <Card className="animate-rise space-y-3 p-4">
        <label className={cn("flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-control border-2 border-dashed p-6 text-center transition-colors", file ? "border-accent bg-accent-soft/40" : "border-line hover:bg-surface-2")}>
          {file ? <FileText className="h-8 w-8 text-accent" /> : <Upload className="h-8 w-8 text-ink-3" />}
          <span className="font-medium">{file ? file.name : "Exportdatei auswählen"}</span>
          <span className="text-xs text-ink-3">{file ? `${Math.ceil(file.size / 1024)} KB` : "CSV oder TXT, höchstens 5 MB (Trennzeichen ; , oder Tab)"}</span>
          <input type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Vorlage</span>
          <Select value={preset} onChange={(e) => onPreset(e.target.value as ScorePresetId)}>
            {SCORE_PRESET_IDS.map((id) => <option key={id} value={id}>{SCORE_PRESETS[id].label}</option>)}
          </Select>
          <span className="mt-1.5 block text-xs text-ink-3">{SCORE_PRESETS[preset].hint}</span>
        </label>
        <Button className="w-full" disabled={!file || pending} onClick={onNext}>
          {pending ? <><Spinner /> Wird gelesen…</> : "Weiter"}
        </Button>
      </Card>
      <Card className="p-4 text-sm text-ink-2">
        <p className="font-medium text-ink">So geht&apos;s</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Vorlagen ordnen typische Spaltennamen vor. <strong>{PRESET_DISCLAIMER}</strong> – die Formate unterscheiden sich je nach Version.</li>
          <li>Zwei Aufbauten: eine Zeile pro Schuss (Schütze, Wert, optional Serie und X/Y) oder eine Zeile pro Schütze (Serientotale, Total).</li>
          <li>Nichts wird gespeichert, bevor du im letzten Schritt bestätigst. Dieselbe Datei kann nur einmal importiert werden.</li>
        </ul>
      </Card>
    </div>
  );
}

function MapStep({ table, fileName, preset, onPreset, mapping, onMapping, layout, onLayout, discipline, onDiscipline, onBack, onNext }: {
  table: ScoreTable;
  fileName: string;
  preset: ScorePresetId;
  onPreset: (p: ScorePresetId) => void;
  mapping: ScoreField[];
  onMapping: (m: ScoreField[]) => void;
  layout: ScoreLayout;
  onLayout: (l: ScoreLayout) => void;
  discipline: string | null;
  onDiscipline: (d: string | null) => void;
  onBack: () => void;
  onNext: (dates: string[]) => void;
}) {
  const samples = useMemo(() => table.headers.map((_, i) => table.rows.map((r) => r[i] ?? "").filter(Boolean).slice(0, 3)), [table]);
  const normalized = useMemo(() => normalizeMapping(mapping, table.headers.length), [mapping, table]);
  const allDisciplines = useMemo(() => buildShooters(table, normalized, layout).disciplines, [table, normalized, layout]);
  const built = useMemo(() => buildShooters(table, normalized, layout, discipline), [table, normalized, layout, discipline]);
  const setField = (col: number, field: ScoreField) => {
    // Einzelfelder nur einmal: bisherige Spalte mit diesem Feld wird «nicht übernommen»
    onMapping(normalized.map((f, i) => (i === col ? field : field !== "ignore" && !MULTI_FIELDS.has(field) && f === field ? "ignore" : f)));
  };
  const encodingLabel = `${table.encoding === "windows-1252" ? "Windows-1252" : table.encoding.toUpperCase()}, Trennzeichen «${table.delimiter === "\t" ? "Tab" : table.delimiter}»`;
  const canNext = !built.errors.length && built.shooters.length > 0;

  return (
    <div className="space-y-3">
      <Card className="animate-rise space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-48 flex-1">
            <span className="mb-1.5 block text-sm font-medium text-ink-2">Vorlage</span>
            <Select value={preset} onChange={(e) => onPreset(e.target.value as ScorePresetId)}>
              {SCORE_PRESET_IDS.map((id) => <option key={id} value={id}>{SCORE_PRESETS[id].label}</option>)}
            </Select>
          </label>
          <p className="pb-3 text-xs text-ink-3">{fileName} · {table.rows.length} Zeilen · {encodingLabel}</p>
        </div>
        {preset !== "generic" ? <Badge tone="warn">{PRESET_DISCLAIMER}</Badge> : null}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Aufbau der Datei</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Aufbau der Datei">
            {([["shots", "Zeile pro Schuss"], ["totals", "Zeile pro Schütze"]] as Array<[ScoreLayout, string]>).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={layout === v} onClick={() => onLayout(v)}
                className={cn("press min-h-11 rounded-control px-3 text-sm font-medium", layout === v ? "bg-accent text-accent-ink" : "border border-line bg-surface text-ink-2 hover:bg-surface-2")}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {allDisciplines.length > 1 ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-2">Disziplin</span>
            <Select value={discipline ?? ""} onChange={(e) => onDiscipline(e.target.value || null)}>
              <option value="">Alle ({allDisciplines.length})</option>
              {allDisciplines.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
            <span className={cn("mt-1.5 block text-xs", discipline === null ? "text-warn" : "text-ink-3")}>
              {discipline === null ? "Achtung: Bei «Alle» werden die Schüsse aller Disziplinen pro Schütze zusammengezählt. " : ""}Pro Import entsteht ein Durchgang mit einem Programm. Weitere Disziplinen bitte einzeln importieren – dieselbe Datei geht nur einmal, deshalb pro Disziplin eine eigene Exportdatei verwenden.
            </span>
          </label>
        ) : null}
      </Card>

      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {table.headers.map((h, i) => (
          <div key={i} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_220px] sm:items-center">
            <div className="min-w-0">
              <div className="truncate font-medium">{h}</div>
              <div className="truncate text-xs text-ink-3">{samples[i]!.length ? samples[i]!.join(" · ") : "leer"}</div>
            </div>
            <Select value={normalized[i] ?? "ignore"} onChange={(e) => setField(i, e.target.value as ScoreField)} aria-label={`Spalte «${h}» übernehmen als`} className={normalized[i] === "ignore" ? "text-ink-3" : undefined}>
              {SCORE_FIELDS.map((f) => <option key={f} value={f}>{SCORE_FIELD_LABELS[f]}</option>)}
            </Select>
          </div>
        ))}
      </Card>

      <SectionPreview built={built} />

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Zurück</Button>
        <Button className="flex-1" onClick={() => onNext(built.dates)} disabled={!canNext}>Weiter zur Zuordnung</Button>
      </div>
    </div>
  );
}

function SectionPreview({ built }: { built: ReturnType<typeof buildShooters> }) {
  const shown = built.shooters.slice(0, 8);
  return (
    <div className="space-y-2">
      <h2 className="px-1 text-sm font-semibold">Vorschau · {built.shooters.length} {built.shooters.length === 1 ? "Schütze" : "Schützen"}{built.skippedRows ? ` · ${built.skippedRows} Zeilen übersprungen` : ""}</h2>
      {built.errors.map((e) => <Alert key={e} tone="warn">{e}</Alert>)}
      {shown.length ? (
        <Card className="divide-y divide-line overflow-hidden">
          {shown.map((s) => {
            const shotSum = Math.round(s.shots.reduce((a, x) => a + x.value, 0) * 10) / 10;
            const series = s.seriesTotals.map((v) => (v === null ? "–" : String(v))).join(" · ");
            return (
              <div key={s.key} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.name}{s.startNo ? <span className="font-normal text-ink-3"> · Startnr. {s.startNo}</span> : null}</div>
                  <div className="truncate text-xs text-ink-3">
                    {s.shots.length ? `${s.shots.length} Schüsse${s.sighters ? ` (+${s.sighters} Probe)` : ""}${s.hasXY ? " · mit Trefferlage" : ""}` : series ? `Serien: ${series}` : "nur Total"}
                  </div>
                  {s.errors.slice(0, 2).map((e) => <p key={e} className="text-xs text-danger">{e}</p>)}
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{s.shots.length ? shotSum : (s.total ?? (s.seriesTotals.length ? Math.round(s.seriesTotals.reduce<number>((a, v) => a + (v ?? 0), 0) * 10) / 10 : "–"))}</span>
              </div>
            );
          })}
          {built.shooters.length > shown.length ? <p className="px-4 py-2 text-xs text-ink-3">… und {built.shooters.length - shown.length} weitere</p> : null}
        </Card>
      ) : null}
    </div>
  );
}

function AssignStep({ table, config, programs, members, programId, onProgram, date, onDate, assignments, onAssignments, onBack, onCommit, pending }: {
  table: ScoreTable;
  config: { layout: ScoreLayout; mapping: ScoreField[]; discipline: string | null };
  programs: ImportProgramOption[];
  members: ImportMemberOption[];
  programId: string;
  onProgram: (id: string) => void;
  date: string;
  onDate: (d: string) => void;
  assignments: Record<string, string>;
  onAssignments: (a: Record<string, string>) => void;
  onBack: () => void;
  onCommit: (plan: ReturnType<typeof planImport>) => void;
  pending: boolean;
}) {
  const [shown, setShown] = useState(SHOW_STEP);
  const program = programs.find((p) => p.id === programId) ?? null;
  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const shooters = useMemo(() => buildShooters(table, normalizeMapping(config.mapping, table.headers.length), config.layout, config.discipline).shooters, [table, config]);
  const matches = useMemo(() => {
    const res = matchAllMembers(shooters.map((s) => (s.name === SINGLE_SHOOTER_NAME ? "" : s.name)), members);
    return new Map(shooters.map((s, i) => [s.key, res[i]!]));
  }, [shooters, members]);
  // Ohne eigene Wahl: sichere Übereinstimmung → Mitglied, sonst Gast
  const valueFor = (key: string) => {
    const own = assignments[key];
    if (own && parseAssignment(own)) return own;
    const m = matches.get(key)?.memberId;
    return m ? `m:${m}` : "guest";
  };
  const plan = useMemo(
    () => planImport(table, config, program ? { stages: program.stages, scoringMode: program.scoringMode } : null, (s) => parseAssignment(valueFor(s.key)) ?? { kind: "guest" }, memberIds),
    // valueFor hängt nur von assignments und matches ab
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, config, program, assignments, matches, memberIds],
  );
  const counts = useMemo(() => {
    const c = { members: 0, guests: 0, skip: 0, errors: 0 };
    for (const p of plan.participants) {
      if (p.assignment.kind === "member") c.members++;
      else if (p.assignment.kind === "guest") c.guests++;
      else c.skip++;
      if (program && p.assignment.kind !== "skip" && p.errors.length) c.errors++;
    }
    return c;
  }, [plan, program]);
  const setOne = (key: string, v: string) => onAssignments({ ...assignments, [key]: v });
  const skipErrors = () => {
    const next = { ...assignments };
    for (const p of plan.participants) if (p.errors.length && p.assignment.kind !== "skip") next[p.shooter.key] = "skip";
    onAssignments(next);
  };
  const decimal = program?.scoringMode === "RINGS_DECIMAL";
  const canCommit = !!program && plan.included > 0 && plan.blocking === 0 && !plan.globalErrors.length && /^\d{4}-\d{2}-\d{2}$/.test(date);

  return (
    <div className="space-y-3">
      <Card className="animate-rise grid gap-3 p-4 sm:grid-cols-[1fr_180px]">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Programm</span>
          <Select value={programId} onChange={(e) => onProgram(e.target.value)}>
            <option value="">Programm wählen…</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}{p.scope === "global" ? "" : " (Verein)"} · {p.stages.reduce((a, s) => a + s.shots, 0)} Schuss</option>)}
          </Select>
          {program ? <span className="mt-1.5 block text-xs text-ink-3">{program.stages.map((s, i) => `${i + 1}. ${s.name}: ${s.shots} × max. ${s.maxPerShot}`).join(" · ")} · Maximum {program.max}</span> : null}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Datum</span>
          <Input type="date" value={date} onChange={(e) => onDate(e.target.value)} required />
        </label>
      </Card>

      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label="Mitglieder" value={counts.members} tone="ok" />
        <StatCard label="Gäste" value={counts.guests} tone="accent" />
        <StatCard label="Mit Fehlern" value={counts.errors} tone={counts.errors ? "warn" : "neutral"} hint={counts.skip ? `${counts.skip} nicht übernommen` : undefined} />
      </div>

      {program && counts.errors ? (
        <Card className="flex flex-wrap items-center gap-2 p-3 text-sm">
          <span className="flex-1 text-ink-2">{counts.errors} {counts.errors === 1 ? "Schütze passt" : "Schützen passen"} nicht zum Programm.</span>
          <Button variant="secondary" size="sm" className="h-11" onClick={skipErrors}>Alle mit Fehlern nicht übernehmen</Button>
        </Card>
      ) : null}
      {plan.globalErrors.map((e) => <Alert key={e} tone="warn">{e}</Alert>)}

      <Card className="divide-y divide-line overflow-hidden">
        {plan.participants.slice(0, shown).map((p) => (
          <ShooterRow key={p.shooter.key} p={p} match={matches.get(p.shooter.key)} members={members} value={valueFor(p.shooter.key)} onChange={(v) => setOne(p.shooter.key, v)} program={program} decimal={decimal} />
        ))}
      </Card>
      {plan.participants.length > shown ? (
        <Button variant="secondary" className="w-full" onClick={() => setShown((s) => s + SHOW_STEP)}>Weitere {Math.min(SHOW_STEP, plan.participants.length - shown)} anzeigen</Button>
      ) : null}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack} disabled={pending}><ArrowLeft className="h-4 w-4" /> Zurück</Button>
        <Button className="flex-1" onClick={() => onCommit(plan)} disabled={pending || !canCommit}>
          {pending ? <><Spinner /> Wird übernommen…</> : !program ? "Programm wählen" : plan.blocking ? `${plan.blocking} mit Fehlern` : `${plan.included} ${plan.included === 1 ? "Resultat" : "Resultate"} übernehmen`}
        </Button>
      </div>
    </div>
  );
}

function ShooterRow({ p, match, members, value, onChange, program, decimal }: {
  p: PlannedParticipant;
  match: MemberMatch | undefined;
  members: ImportMemberOption[];
  value: string;
  onChange: (v: string) => void;
  program: ImportProgramOption | null;
  decimal: boolean;
}) {
  const skip = p.assignment.kind === "skip";
  const errors = skip ? [] : p.errors;
  const suggestionIds = new Set(match?.suggestions.map((s) => s.id) ?? []);
  const ev = p.evaluation;
  return (
    <div className={cn("flex flex-wrap items-start gap-3 px-4 py-3 sm:flex-nowrap", skip && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {errors.length ? <XCircle className="h-4 w-4 shrink-0 text-danger" aria-label="Fehler" /> : !skip && ev.warnings.length ? <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-label="Hinweis" /> : <CheckCircle2 className={cn("h-4 w-4 shrink-0", skip ? "text-ink-3" : "text-ok")} aria-label="In Ordnung" />}
          <span className="truncate font-medium">{p.shooter.name}</span>
        </div>
        <div className="truncate text-xs text-ink-3">
          {[p.note, p.shooter.shots.length ? `${ev.shotCount} Schüsse` : "Totale", `Z. ${p.shooter.firstLine}`].filter(Boolean).join(" · ")}
        </div>
        {program && !skip && ev.stages.length ? (
          <div className="mt-1 text-xs tabular-nums text-ink-2">
            <strong className="text-sm text-ink">{formatScore(ev.total, decimal)}</strong> von {program.max}
            {program.stages.length > 1 ? <span className="text-ink-3"> · {program.stages.map((_, i) => { const st = ev.stages.find((x) => x.stageIndex === i); return st ? formatScore(st.total, decimal) : "–"; }).join(" · ")}</span> : null}
          </div>
        ) : null}
        {errors.map((e, k) => <p key={`e${k}`} className="mt-1 text-xs text-danger">{e}</p>)}
        {!skip ? ev.warnings.map((w, k) => <p key={`w${k}`} className="mt-1 text-xs text-warn">{w}</p>) : null}
      </div>
      <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${p.shooter.name}: zuordnen`} className="w-full sm:w-56">
        {match?.suggestions.length ? (
          <optgroup label="Vorschläge">
            {match.suggestions.map((s) => <option key={`s${s.id}`} value={`m:${s.id}`}>{s.name} ({Math.round(s.score * 100)} %)</option>)}
          </optgroup>
        ) : null}
        <optgroup label="Mitglieder">
          {members.filter((m) => !suggestionIds.has(m.id)).map((m) => <option key={m.id} value={`m:${m.id}`}>{m.name}</option>)}
        </optgroup>
        <option value="guest">Als Gast</option>
        <option value="skip">Nicht übernehmen</option>
      </Select>
    </div>
  );
}

function DoneStep({ result, onRestart }: { result: Extract<CommitScoreImportResult, { status: "created" }>; onRestart: () => void }) {
  return (
    <div className="space-y-3">
      <Card className="animate-rise p-5 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-ok" />
        <h2 className="mt-2 text-lg font-semibold">Import abgeschlossen</h2>
        <p className="mt-1 text-sm text-ink-3">
          <UserRound className="mr-1 inline h-4 w-4 align-[-3px]" />
          {result.participants} {result.participants === 1 ? "Resultat" : "Resultate"} übernommen{result.guests ? `, davon ${result.guests} ${result.guests === 1 ? "Gast" : "Gäste"}` : ""}
        </p>
      </Card>
      <div className="flex flex-wrap gap-2">
        <LinkButton href={`/scores/matches/${result.matchId}`} className="flex-1">Zum Durchgang</LinkButton>
        <Button variant="secondary" onClick={onRestart}>Weitere Datei</Button>
      </div>
    </div>
  );
}
