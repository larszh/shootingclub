"use client";

import { useState, useTransition } from "react";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/core";
import { Alert, Button, Select } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { saveTranslationsAction } from "../actions";
import { parseImportFile, validateEntries, type DictionaryContext, type ValidationResult } from "../logic";
import { entryErrorMessage, type translationsT } from "../texts";
import { DiffView } from "./diff";

type T = ReturnType<typeof translationsT>;

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const PREVIEW_LIMIT = 200;

export function ImportDialog({ open, onClose, t, ctx, onApplied }: { open: boolean; onClose: () => void; t: T; ctx: DictionaryContext; onApplied: () => void }) {
  const [locale, setLocale] = useState<Locale>("fr");
  const [fileName, setFileName] = useState("");
  const [raw, setRaw] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [pending, start] = useTransition();

  function evaluate(text: string, l: Locale, allowSwitch: boolean) {
    setError(null);
    setResult(null);
    let parsed = parseImportFile(text, allowSwitch ? undefined : l);
    if (parsed.ok && allowSwitch && parsed.locale && parsed.locale !== l) {
      setLocale(parsed.locale);
      l = parsed.locale;
      parsed = parseImportFile(text, l);
    }
    if (!parsed.ok) {
      setError(t(`import.${parsed.error}`));
      return;
    }
    setResult(validateEntries(ctx, l, parsed.entries, { skipEmpty: true }));
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      setRaw(null);
      setResult(null);
      setError(t("import.tooLarge"));
      return;
    }
    const text = await file.text();
    setRaw(text);
    evaluate(text, locale, true);
  }

  function apply() {
    if (!result) return;
    start(async () => {
      const res = await saveTranslationsAction({ locale, source: "import", entries: result.changes.map((c) => ({ key: c.key, value: c.after })) });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "");
      onApplied();
      onClose();
    });
  }

  return (
    <Dialog
      open={open} onClose={onClose} title={t("import.title")} description={t("import.description")} size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>{t("cell.cancel")}</Button>
          <Button type="button" onClick={apply} disabled={pending || !result || result.changes.length === 0}>
            {pending ? <Spinner /> : null} {t("import.apply", { n: result?.changes.length ?? 0 })}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm font-medium text-ink-2">
          {t("import.locale")}
          <Select
            className="mt-1.5" value={locale}
            onChange={(e) => {
              const l = e.target.value as Locale;
              setLocale(l);
              if (raw) evaluate(raw, l, false);
            }}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
            ))}
          </Select>
        </label>
        <label className="block text-sm font-medium text-ink-2">
          {t("import.file")}
          <input
            type="file" accept="application/json,.json"
            className="mt-1.5 block w-full text-sm file:mr-3 file:h-11 file:rounded-control file:border file:border-line file:bg-surface file:px-4 file:text-sm file:font-medium"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
        {fileName ? <p className="text-xs text-ink-3 break-all">{fileName}</p> : null}
        <p className="text-xs text-ink-3">{t("import.hint")}</p>
        {error ? <Alert>{error}</Alert> : null}
        {result ? (
          <>
            <Alert tone={result.errors.length ? "warn" : "info"}>
              {t("import.summary", { changes: result.changes.length, unchanged: result.unchanged, skipped: result.skipped, errors: result.errors.length })}
            </Alert>
            {result.errors.length ? (
              <details className="rounded-control border border-line">
                <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">{t("import.errors", { n: result.errors.length })}</summary>
                <ul className="max-h-48 divide-y divide-line overflow-y-auto">
                  {result.errors.slice(0, PREVIEW_LIMIT).map((e) => (
                    <li key={e.key} className="px-3 py-2 text-sm">
                      <span className="font-mono text-xs break-all">{e.key}</span>
                      <span className="block text-danger">{entryErrorMessage(t, e)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {result.changes.length ? (
              <ul className="max-h-[45vh] divide-y divide-line overflow-y-auto rounded-control border border-line">
                {result.changes.slice(0, PREVIEW_LIMIT).map((c) => (
                  <li key={c.key} className="space-y-1 px-3 py-2">
                    <p className="font-mono text-xs break-all text-ink-3">
                      {c.key} {c.op === "reset" ? <span className="font-sans">· {t("import.resetMarker")}</span> : null}
                    </p>
                    {c.before ? <DiffView before={c.before} after={c.after} /> : <p className="text-sm whitespace-pre-line text-ok">{c.after}</p>}
                  </li>
                ))}
                {result.changes.length > PREVIEW_LIMIT ? (
                  <li className="px-3 py-2 text-xs text-ink-3">{t("import.more", { n: result.changes.length - PREVIEW_LIMIT })}</li>
                ) : null}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
