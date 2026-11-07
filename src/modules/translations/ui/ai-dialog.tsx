"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { LOCALE_LABELS, type Locale } from "@/lib/i18n/core";
import { Alert, Button, Select } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { saveTranslationsAction, translateChunkAction } from "../actions";
import { AI_MAX_KEYS_PER_RUN, chunkForAi, type Row } from "../logic";
import type { translationsT } from "../texts";
import { DiffView } from "./diff";

type T = ReturnType<typeof translationsT>;
type Target = Exclude<Locale, "de">;
const TARGETS: Target[] = ["fr", "it", "en"];

type Suggestion = { key: string; before: string; german: string; text: string; accept: boolean };

export function AiDialog({
  open, onClose, t, rows, filtered, selected, defaultLocale, onApplied,
}: {
  open: boolean;
  onClose: () => void;
  t: T;
  rows: Row[];
  filtered: Row[];
  selected: Set<string>;
  defaultLocale: Locale;
  onApplied: () => void;
}) {
  const [target, setTarget] = useState<Target>(defaultLocale === "de" ? "fr" : (defaultLocale as Target));
  const [mode, setMode] = useState<"selected" | "missing">(selected.size > 0 ? "selected" : "missing");
  const [phase, setPhase] = useState<"setup" | "running" | "review">("setup");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [info, setInfo] = useState({ rejected: 0, missing: 0, unchanged: 0 });
  const cancelled = useRef(false);
  const [saving, startSave] = useTransition();

  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);

  const candidates = useMemo(() => {
    const list = mode === "selected" ? rows.filter((r) => selected.has(r.key)) : filtered.filter((r) => r.cells[target].needsWork);
    return list.filter((r) => r.cells.de.value !== "");
  }, [mode, rows, filtered, selected, target]);
  const capped = candidates.slice(0, AI_MAX_KEYS_PER_RUN);
  const chunks = useMemo(() => chunkForAi(capped.map((r) => ({ key: r.key, source: r.cells.de.value }))), [capped]);

  async function run() {
    cancelled.current = false;
    setError(null);
    setPhase("running");
    setProgress({ done: 0, total: capped.length });
    const found: Suggestion[] = [];
    let rejected = 0;
    let missing = 0;
    let unchanged = 0;
    let done = 0;
    for (const chunk of chunks) {
      if (cancelled.current) break;
      let res;
      try {
        res = await translateChunkAction({ locale: target, keys: chunk.map((c) => c.key) });
      } catch {
        setError(t("ai.failed"));
        break;
      }
      if (!res.ok) {
        setError(res.error);
        break;
      }
      const data = res.data!;
      rejected += data.rejected;
      missing += data.missing.length;
      for (const s of data.suggestions) {
        const row = byKey.get(s.key);
        if (!row) continue;
        const before = row.cells[target].value;
        if (before === s.text) {
          unchanged += 1;
          continue;
        }
        found.push({ key: s.key, before, german: row.cells.de.value, text: s.text, accept: true });
      }
      done += chunk.length;
      setProgress({ done, total: capped.length });
      setSuggestions([...found]);
    }
    setInfo({ rejected, missing, unchanged });
    setSuggestions(found);
    setPhase("review");
  }

  function setAll(on: boolean) {
    setSuggestions((s) => s.map((x) => ({ ...x, accept: on })));
  }

  const accepted = suggestions.filter((s) => s.accept);

  function apply() {
    startSave(async () => {
      const res = await saveTranslationsAction({ locale: target, source: "ai", entries: accepted.map((s) => ({ key: s.key, value: s.text })) });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "");
      onApplied();
      onClose();
    });
  }

  const footer =
    phase === "setup" ? (
      <>
        <Button type="button" variant="ghost" onClick={onClose}>{t("cell.cancel")}</Button>
        <Button type="button" onClick={run} disabled={capped.length === 0}>
          <Sparkles className="h-4 w-4" aria-hidden /> {t("ai.start", { n: capped.length })}
        </Button>
      </>
    ) : phase === "running" ? (
      <Button type="button" variant="secondary" onClick={() => (cancelled.current = true)}>{t("ai.stop")}</Button>
    ) : (
      <>
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>{t("ai.discard")}</Button>
        <Button type="button" onClick={apply} disabled={saving || accepted.length === 0}>
          {saving ? <Spinner /> : null} {t("ai.apply", { n: accepted.length })}
        </Button>
      </>
    );

  return (
    <Dialog open={open} onClose={phase === "running" ? () => undefined : onClose} dismissible={phase !== "running"} title={t("ai.title")} description={t("ai.description")} size="lg" footer={footer}>
      {phase === "setup" ? (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-ink-2">
            {t("ai.target")}
            <Select className="mt-1.5" value={target} onChange={(e) => setTarget(e.target.value as Target)}>
              {TARGETS.map((l) => (
                <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
              ))}
            </Select>
          </label>
          <fieldset className="space-y-1">
            <legend className="mb-1.5 text-sm font-medium text-ink-2">{t("ai.which")}</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="radio" name="ai-mode" className="h-5 w-5 accent-[var(--accent)]" checked={mode === "missing"} onChange={() => setMode("missing")} />
              {t("ai.modeMissing", { n: filtered.filter((r) => r.cells[target].needsWork && r.cells.de.value).length })}
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="radio" name="ai-mode" className="h-5 w-5 accent-[var(--accent)]" checked={mode === "selected"} onChange={() => setMode("selected")} disabled={selected.size === 0} />
              {t("ai.modeSelected", { n: selected.size })}
            </label>
          </fieldset>
          <p className="text-sm text-ink-3">{t("ai.chunks", { n: capped.length, chunks: chunks.length })}</p>
          {candidates.length > capped.length ? <Alert tone="warn">{t("ai.capped", { max: AI_MAX_KEYS_PER_RUN })}</Alert> : null}
          <p className="text-xs text-ink-3">{t("ai.privacy")}</p>
        </div>
      ) : null}

      {phase === "running" ? (
        <div className="space-y-3" aria-live="polite">
          <p className="flex items-center gap-2 text-sm"><Spinner /> {t("ai.progress", { done: progress.done, total: progress.total })}</p>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <div className="h-full bg-ink transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
          <p className="text-sm text-ink-3">{t("ai.found", { n: suggestions.length })}</p>
        </div>
      ) : null}

      {phase === "review" ? (
        <div className="space-y-3">
          {error ? <Alert>{error}</Alert> : null}
          <p className="text-sm text-ink-2">
            {t("ai.summary", { n: suggestions.length, unchanged: info.unchanged })}
            {info.rejected + info.missing > 0 ? " " + t("ai.summaryRejected", { n: info.rejected + info.missing }) : null}
          </p>
          {suggestions.length > 0 ? (
            <>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" className="h-11" onClick={() => setAll(true)}>{t("ai.all")}</Button>
                <Button type="button" variant="secondary" size="sm" className="h-11" onClick={() => setAll(false)}>{t("ai.none")}</Button>
              </div>
              <ul className="max-h-[55vh] divide-y divide-line overflow-y-auto rounded-control border border-line">
                {suggestions.map((s, i) => (
                  <li key={s.key} className="flex items-start gap-2 px-2 py-2">
                    <label className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center">
                      <input
                        type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={s.accept} aria-label={t("ai.acceptKey", { key: s.key })}
                        onChange={(e) => setSuggestions((list) => list.map((x, j) => (j === i ? { ...x, accept: e.target.checked } : x)))}
                      />
                    </label>
                    <div className="min-w-0 flex-1 space-y-1 py-1">
                      <p className="font-mono text-xs break-all text-ink-3">{s.key}</p>
                      <p className="text-xs text-ink-3 whitespace-pre-line"><span className="font-semibold">DE</span> {s.german}</p>
                      {s.before ? <DiffView before={s.before} after={s.text} /> : <p className="text-sm whitespace-pre-line text-ok">{s.text}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}
