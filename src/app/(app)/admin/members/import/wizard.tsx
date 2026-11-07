"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, Upload, XCircle } from "lucide-react";
import { Alert, Badge, Button, Card, LinkButton, Select, StatCard } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/form";
import { isNavigationError, toast } from "@/lib/ui-feedback";
import { cn } from "@/lib/utils";
import { getT, type Locale, type TFunction } from "@/lib/i18n/core";
import { IMPORT_MAX_ROWS, suggestMapping, type DuplicateReason, type ImportDecision, type ImportField, type ImportPresetId } from "@/modules/members/import";
import { analyzeImportAction, commitImportAction, parseImportFileAction, type ImportSummary, type ParsedImport, type PreviewRow } from "@/modules/members/import-actions";

type Step = "upload" | "map" | "preview" | "done";

/** Schlüssel adm1.import.dup.<Grund> */
const DUPLICATE_REASON: Record<DuplicateReason, string> = {
  email: "adm1.import.dup.email",
  memberNumber: "adm1.import.dup.memberNumber",
  nameBirth: "adm1.import.dup.nameBirth",
  name: "adm1.import.dup.name",
};
const SHOW_STEP = 100;

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "upload", label: "adm1.import.step.upload" },
  { id: "map", label: "adm1.import.step.map" },
  { id: "preview", label: "adm1.import.step.preview" },
  { id: "done", label: "adm1.import.step.done" },
];

export function ImportWizard({ locale, fields, presets, categoryNames }: {
  locale: Locale;
  fields: Array<{ value: ImportField; label: string }>;
  presets: Array<{ id: ImportPresetId; label: string; hint: string }>;
  categoryNames: string[];
}) {
  const t = getT(locale);
  const [step, setStep] = useState<Step>("upload");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [preset, setPreset] = useState<ImportPresetId>("excel");
  const [mapping, setMapping] = useState<ImportField[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [decisions, setDecisions] = useState<ImportDecision[]>([]);
  const [sendInvites, setSendInvites] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const guard = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        if (isNavigationError(e)) throw e;
        setError(t("adm1.common.failed"));
      }
    });

  const readFile = () => guard(async () => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    const res = await parseImportFileAction(fd);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setParsed(res.data!);
    setPreset(res.data!.preset);
    setMapping(res.data!.mapping);
    setStep("map");
  });

  const analyze = () => guard(async () => {
    if (!parsed) return;
    const res = await analyzeImportAction({ rowsJson: JSON.stringify(parsed.rows), mapping });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPreview(res.data!.rows);
    setDecisions(res.data!.rows.map((r) => r.decision));
    setStep("preview");
  });

  const commit = () => guard(async () => {
    if (!parsed) return;
    const res = await commitImportAction({ rowsJson: JSON.stringify(parsed.rows), mapping, decisions, sendInvites, fileName: parsed.fileName });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSummary(res.data!);
    setStep("done");
    toast.success(t("adm1.import.doneTitle"));
  });

  const restart = () => {
    setStep("upload");
    setFile(null);
    setParsed(null);
    setPreview([]);
    setDecisions([]);
    setSummary(null);
    setError(null);
  };

  return (
    <div>
      <ol className="mb-4 grid grid-cols-4 gap-1" aria-label={t("adm1.import.steps")}>
        {STEPS.map((s, i) => {
          const idx = STEPS.findIndex((x) => x.id === step);
          return (
            <li key={s.id} className="flex flex-col items-center gap-1 text-xs" aria-current={s.id === step ? "step" : undefined}>
              <span className={cn("h-1.5 w-full rounded-full", i <= idx ? "bg-accent" : "bg-line")} />
              <span className={i === idx ? "font-semibold text-ink" : "text-ink-3"}>{i + 1}. {t(s.label)}</span>
            </li>
          );
        })}
      </ol>

      {error ? <Alert className="mb-3">{error}</Alert> : null}

      {step === "upload" ? (
        <UploadStep t={t} file={file} onFile={setFile} onNext={readFile} pending={pending} presets={presets} />
      ) : null}

      {step === "map" && parsed ? (
        <MapStep
          t={t}
          parsed={parsed}
          fields={fields}
          presets={presets}
          preset={preset}
          mapping={mapping}
          categoryNames={categoryNames}
          onPreset={(p) => {
            setPreset(p);
            setMapping(suggestMapping(parsed.headers, p));
          }}
          onMapping={setMapping}
          onBack={() => setStep("upload")}
          onNext={analyze}
          pending={pending}
        />
      ) : null}

      {step === "preview" ? (
        <PreviewStep
          t={t}
          rows={preview}
          decisions={decisions}
          onDecisions={setDecisions}
          sendInvites={sendInvites}
          onSendInvites={setSendInvites}
          onBack={() => setStep("map")}
          onCommit={commit}
          pending={pending}
        />
      ) : null}

      {step === "done" && summary ? <DoneStep t={t} summary={summary} onRestart={restart} /> : null}
    </div>
  );
}

function UploadStep({ t, file, onFile, onNext, pending, presets }: { t: TFunction; file: File | null; onFile: (f: File | null) => void; onNext: () => void; pending: boolean; presets: Array<{ id: string; label: string; hint: string }> }) {
  return (
    <div className="space-y-3">
      <Card className="animate-rise p-4">
        <label className={cn("flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-control border-2 border-dashed p-6 text-center transition-colors", file ? "border-accent bg-accent-soft/40" : "border-line hover:bg-surface-2")}>
          {file ? <FileSpreadsheet className="h-8 w-8 text-accent" /> : <Upload className="h-8 w-8 text-ink-3" />}
          <span className="font-medium">{file ? file.name : t("adm1.import.chooseFile")}</span>
          <span className="text-xs text-ink-3">{file ? `${Math.ceil(file.size / 1024)} KB` : t("adm1.import.fileLimits", { rows: IMPORT_MAX_ROWS })}</span>
          <input
            type="file"
            accept=".csv,.txt,.tsv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <Button className="mt-3 w-full" disabled={!file || pending} onClick={onNext}>
          {pending ? <><Spinner /> {t("adm1.import.reading")}</> : t("adm1.pager.next")}
        </Button>
      </Card>
      <Card className="p-4 text-sm text-ink-2">
        <p className="font-medium text-ink">{t("adm1.import.howTo")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {presets.map((p) => <li key={p.id}><strong>{p.label}:</strong> {p.hint}</li>)}
          <li>{t("adm1.import.howTo1")}</li>
          <li>{t("adm1.import.howTo2")}</li>
        </ul>
      </Card>
    </div>
  );
}

function MapStep({ t, parsed, fields, presets, preset, mapping, categoryNames, onPreset, onMapping, onBack, onNext, pending }: {
  t: TFunction;
  parsed: ParsedImport;
  fields: Array<{ value: ImportField; label: string }>;
  presets: Array<{ id: ImportPresetId; label: string }>;
  preset: ImportPresetId;
  mapping: ImportField[];
  categoryNames: string[];
  onPreset: (p: ImportPresetId) => void;
  onMapping: (m: ImportField[]) => void;
  onBack: () => void;
  onNext: () => void;
  pending: boolean;
}) {
  const samples = useMemo(
    () => parsed.headers.map((_, i) => parsed.rows.map((r) => r[i] ?? "").filter(Boolean).slice(0, 3)),
    [parsed],
  );
  const hasName = mapping.some((f) => f === "name" || f === "firstName" || f === "lastName");
  const setField = (col: number, field: ImportField) => {
    // Jedes Feld nur einmal: bisherige Spalte mit diesem Feld wird «nicht übernommen».
    onMapping(mapping.map((f, i) => (i === col ? field : field !== "ignore" && f === field ? "ignore" : f)));
  };
  const encodingLabel = parsed.encoding === "xlsx" ? "Excel" : `${parsed.encoding === "windows-1252" ? "Windows-1252" : parsed.encoding.toUpperCase()}, ${t("adm1.import.delimiter", { d: parsed.delimiter === "\t" ? "Tab" : parsed.delimiter })}`;

  return (
    <div className="space-y-3">
      <Card className="animate-rise p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-48 flex-1">
            <span className="mb-1.5 block text-sm font-medium text-ink-2">{t("adm1.import.preset")}</span>
            <Select value={preset} onChange={(e) => onPreset(e.target.value as ImportPresetId)}>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </label>
          <p className="pb-3 text-xs text-ink-3">{parsed.fileName} · {t("adm1.import.rows", { n: parsed.rows.length })} · {encodingLabel}</p>
        </div>
      </Card>

      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {parsed.headers.map((h, i) => (
          <div key={i} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_220px] sm:items-center">
            <div className="min-w-0">
              <div className="truncate font-medium">{h}</div>
              <div className="truncate text-xs text-ink-3">{samples[i]!.length ? samples[i]!.join(" · ") : t("adm1.import.empty")}</div>
            </div>
            <Select value={mapping[i] ?? "ignore"} onChange={(e) => setField(i, e.target.value as ImportField)} aria-label={t("adm1.import.mapAs", { col: h })} className={mapping[i] === "ignore" ? "text-ink-3" : undefined}>
              {fields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
          </div>
        ))}
      </Card>

      {mapping.includes("category") && categoryNames.length ? (
        <p className="px-1 text-xs text-ink-3">{t("adm1.import.categoriesByName", { names: categoryNames.join(", ") })}</p>
      ) : null}
      {!hasName ? <Alert tone="warn">{t("adm1.import.needName")}</Alert> : null}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack} disabled={pending}><ArrowLeft className="h-4 w-4" /> {t("adm1.common.back")}</Button>
        <Button className="flex-1" onClick={onNext} disabled={pending || !hasName}>{pending ? <><Spinner /> {t("adm1.import.checking")}</> : t("adm1.import.toPreview")}</Button>
      </div>
    </div>
  );
}

type PreviewFilter = "all" | "errors" | "warnings" | "duplicates" | "new";

function PreviewStep({ t, rows, decisions, onDecisions, sendInvites, onSendInvites, onBack, onCommit, pending }: {
  t: TFunction;
  rows: PreviewRow[];
  decisions: ImportDecision[];
  onDecisions: (d: ImportDecision[]) => void;
  sendInvites: boolean;
  onSendInvites: (v: boolean) => void;
  onBack: () => void;
  onCommit: () => void;
  pending: boolean;
}) {
  const [filter, setFilter] = useState<PreviewFilter>("all");
  const [shown, setShown] = useState(SHOW_STEP);
  const counts = useMemo(() => {
    const c = { create: 0, update: 0, skip: 0, errors: 0, warnings: 0, duplicates: 0, withEmail: 0, accounts: 0 };
    rows.forEach((r, i) => {
      c[decisions[i]!]++;
      if (r.errors.length) c.errors++;
      if (r.warnings.length) c.warnings++;
      if (r.duplicate) c.duplicates++;
      if (decisions[i] === "create" && r.willInvite) {
        if (r.existingAccount) c.accounts++;
        else c.withEmail++;
      }
    });
    return c;
  }, [rows, decisions]);
  const visible = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) =>
      filter === "all" ? true : filter === "errors" ? r.errors.length > 0 : filter === "warnings" ? r.warnings.length > 0 : filter === "duplicates" ? !!r.duplicate : decisions[i] === "create",
    );
  const setOne = (i: number, d: ImportDecision) => onDecisions(decisions.map((x, j) => (j === i ? d : x)));
  const setDuplicates = (d: ImportDecision) => onDecisions(decisions.map((x, j) => (rows[j]!.duplicate && !rows[j]!.errors.length ? d : x)));
  const todo = counts.create + counts.update;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label={t("adm1.import.new")} value={counts.create} tone="ok" />
        <StatCard label={t("adm1.import.update")} value={counts.update} tone="accent" />
        <StatCard label={t("adm1.import.skip")} value={counts.skip} tone={counts.errors ? "warn" : "neutral"} hint={counts.errors ? t("adm1.import.withErrors", { n: counts.errors }) : undefined} />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label={t("adm1.import.filterRows")}>
        {([
          ["all", `${t("adm1.common.all")} · ${rows.length}`],
          ["errors", `${t("adm1.import.errors")} · ${counts.errors}`],
          ["warnings", `${t("adm1.import.warnings")} · ${counts.warnings}`],
          ["duplicates", `${t("adm1.import.existing")} · ${counts.duplicates}`],
          ["new", `${t("adm1.import.new")} · ${counts.create}`],
        ] as Array<[PreviewFilter, string]>).map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={filter === v} onClick={() => { setFilter(v); setShown(SHOW_STEP); }}
            className={cn("press h-10 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap", filter === v ? "bg-accent text-accent-ink" : "border border-line bg-surface text-ink-2 hover:bg-surface-2")}>
            {l}
          </button>
        ))}
      </div>

      {counts.duplicates ? (
        <Card className="flex flex-wrap items-center gap-2 p-3 text-sm">
          <span className="flex-1 text-ink-2">{t(counts.duplicates === 1 ? "adm1.import.dupCount.one" : "adm1.import.dupCount.other", { n: counts.duplicates })}</span>
          <Button variant="secondary" size="sm" className="h-11" onClick={() => setDuplicates("update")}>{t("adm1.import.updateAll")}</Button>
          <Button variant="secondary" size="sm" className="h-11" onClick={() => setDuplicates("skip")}>{t("adm1.import.skipAll")}</Button>
        </Card>
      ) : null}

      <Card className="divide-y divide-line overflow-hidden">
        {visible.slice(0, shown).map(({ r, i }) => (
          <div key={r.line} className="flex flex-wrap items-start gap-3 px-4 py-3 sm:flex-nowrap">
            <span className="mt-0.5 w-10 shrink-0 text-xs tabular-nums text-ink-3">{t("adm1.import.lineShort", { n: r.line })}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {r.errors.length ? <XCircle className="h-4 w-4 shrink-0 text-danger" aria-label={t("adm1.common.error")} /> : r.warnings.length ? <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-label={t("adm1.import.warning")} /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" aria-label={t("adm1.import.ok")} />}
                <span className="truncate font-medium">{r.name}</span>
              </div>
              <div className="truncate text-xs text-ink-3">{[r.email ?? t("adm1.import.noEmail"), r.info].filter(Boolean).join(" · ")}</div>
              {r.duplicate ? <div className="mt-1"><Badge tone="accent">{t("adm1.import.existingAs", { name: r.duplicate.name, reason: t(DUPLICATE_REASON[r.duplicate.reason]) })}</Badge></div> : null}
              {r.existingAccount ? <div className="mt-1"><Badge tone="outline">{t("adm1.import.hasAccount")}</Badge></div> : null}
              {r.errors.map((e, k) => <p key={`e${k}`} className="mt-1 text-xs text-danger">{e}</p>)}
              {r.warnings.map((w, k) => <p key={`w${k}`} className="mt-1 text-xs text-warn">{w}</p>)}
            </div>
            <Select
              value={decisions[i]}
              onChange={(e) => setOne(i, e.target.value as ImportDecision)}
              aria-label={t("adm1.import.lineAction", { n: r.line })}
              className="w-full sm:w-40"
              disabled={r.errors.length > 0}
            >
              {!r.errors.length ? <option value="create">{t(r.duplicate ? "adm1.import.createExtra" : "adm1.import.create")}</option> : null}
              {r.duplicate && !r.errors.length ? <option value="update">{t("adm1.import.update")}</option> : null}
              <option value="skip">{t("adm1.import.skip")}</option>
            </Select>
          </div>
        ))}
        {!visible.length ? <p className="p-4 text-sm text-ink-3">{t("adm1.import.noRows")}</p> : null}
      </Card>
      {visible.length > shown ? (
        <Button variant="secondary" className="w-full" onClick={() => setShown((s) => s + SHOW_STEP)}>{t("adm1.import.showMore", { n: Math.min(SHOW_STEP, visible.length - shown) })}</Button>
      ) : null}

      <Card className="p-4">
        <Switch
          label={t("adm1.import.sendInvites")}
          description={`${t("adm1.import.sendInvitesHint", { n: counts.withEmail })}${counts.accounts ? ` ${t("adm1.import.sendInvitesAccounts", { n: counts.accounts })}` : ""}`}
          checked={sendInvites}
          onChange={onSendInvites}
        />
      </Card>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack} disabled={pending}><ArrowLeft className="h-4 w-4" /> {t("adm1.common.back")}</Button>
        <Button className="flex-1" onClick={onCommit} disabled={pending || todo === 0}>
          {pending ? <><Spinner /> {t("adm1.import.committing")}</> : todo ? t(todo === 1 ? "adm1.import.commit.one" : "adm1.import.commit.other", { n: todo }) : t("adm1.import.nothing")}
        </Button>
      </div>
    </div>
  );
}

function DoneStep({ t, summary, onRestart }: { t: TFunction; summary: ImportSummary; onRestart: () => void }) {
  return (
    <div className="space-y-3">
      <Card className="animate-rise p-5 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-ok" />
        <h2 className="mt-2 text-lg font-semibold">{t("adm1.import.doneTitle")}</h2>
        <p className="mt-1 text-sm text-ink-3">
          {t("adm1.import.doneSummary", { created: summary.created, updated: summary.updated, skipped: summary.skipped })}
          {summary.invited ? ` · ${t("adm1.import.mailsSent", { n: summary.invited })}` : ""}
        </p>
      </Card>
      {summary.accountInvites ? (
        <Alert tone="ok">
          {t(summary.accountInvites === 1 ? "adm1.import.accountInvites.one" : "adm1.import.accountInvites.other", { n: summary.accountInvites })} <Link href="/admin/members/invitations" className="underline">{t("adm1.inv.open")}</Link>
        </Alert>
      ) : null}
      {summary.failed ? (
        <Alert>
          {t("adm1.import.failed", { n: summary.failed, lines: `${summary.failedLines.slice(0, 20).join(", ")}${summary.failedLines.length > 20 ? " …" : ""}` })}
          {summary.rowErrors?.length ? (
            <ul className="mt-1.5 list-disc pl-5">
              {summary.rowErrors.slice(0, 20).map((e) => <li key={e.line}>{t("adm1.import.lineError", { n: e.line, error: e.error })}</li>)}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <LinkButton href="/admin/members?sort=-created" className="flex-1">{t("adm1.import.toList")}</LinkButton>
        <Button variant="secondary" onClick={onRestart}>{t("adm1.import.anotherFile")}</Button>
      </div>
      <p className="text-center text-xs text-ink-3"><Link href="/admin/members?access=never" className="underline">{t("adm1.import.showNoAccess")}</Link></p>
    </div>
  );
}
