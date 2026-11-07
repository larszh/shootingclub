"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCopy, FileText, Plus, Printer, Save, Sparkles, Trash2 } from "lucide-react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { confirmDialog } from "@/components/ui/dialog";
import { toast, toastResult } from "@/components/ui/toaster";
import { useT } from "@/components/locale";
import { generateReportAction, saveReportDraftAction } from "../actions";
import type { ReportDraft } from "../service";

type Section = { heading: string; body: string };

export function reportPlainText(title: string, sections: readonly Section[]): string {
  return [title.trim(), ...sections.map((s) => [s.heading.trim(), s.body.trim()].filter(Boolean).join("\n"))].filter(Boolean).join("\n\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Jahresbericht: Entwurf mit Claude erstellen, bearbeiten, zwischenspeichern, kopieren, drucken. */
export function ReportEditor({ year, clubName, initial, ai, stale }: {
  year: number;
  clubName: string;
  initial: ReportDraft | null;
  ai: { ok: true } | { ok: false; messageKey: string };
  /** Kennzahlen haben sich seit dem Entwurf geändert */
  stale: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [sections, setSections] = useState<Section[]>(initial?.sections ?? []);
  const [hasDraft, setHasDraft] = useState(!!initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"gen" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function generate() {
    if (hasDraft && !(await confirmDialog({ title: t("aicontent.report.regenQ"), message: t("aicontent.report.regenText"), confirmLabel: t("aicontent.report.regen") }))) return;
    setBusy("gen");
    setError(null);
    start(async () => {
      const res = await generateReportAction(year);
      setBusy(null);
      if (!res.ok) return setError(res.error);
      if (res.data) {
        setTitle(res.data.title);
        setSections(res.data.sections);
        setHasDraft(true);
        setDirty(false);
      }
      toastResult(res);
      router.refresh();
    });
  }

  function save() {
    setBusy("save");
    start(async () => {
      const res = await saveReportDraftAction(year, { title, sections });
      setBusy(null);
      toastResult(res);
      if (res.ok) setDirty(false);
    });
  }

  function update(i: number, patch: Partial<Section>) {
    setSections((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    setDirty(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(reportPlainText(title, sections));
      toast.success(t("aicontent.report.copied"));
    } catch {
      toast.error(t("aicontent.report.copyFailed"));
    }
  }

  function print() {
    const w = window.open("", "_blank");
    if (!w) return toast.error(t("aicontent.report.popupBlocked"));
    const body = sections
      .map((s) => `${s.heading.trim() ? `<h2>${escapeHtml(s.heading)}</h2>` : ""}<p>${escapeHtml(s.body).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>")}</p>`)
      .join("");
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title || clubName)}</title>` +
      `<style>body{font:12pt/1.5 system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem;color:#111}h1{font-size:18pt}h2{font-size:13pt;margin-top:1.4em}.club{color:#555;font-size:10pt}</style>` +
      `</head><body><p class="club">${escapeHtml(clubName)}</p><h1>${escapeHtml(title)}</h1>${body}</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="space-y-4">
      <Card className="animate-rise space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Sparkles className="h-4 w-4" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{t("aicontent.report.draftTitle")}</h2>
            <p className="text-sm text-ink-3">{t("aicontent.report.draftIntro")}</p>
          </div>
        </div>
        {ai.ok ? (
          <Button className="w-full" onClick={generate} disabled={!!busy}>
            {busy === "gen" ? <Spinner /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {busy === "gen" ? t("aicontent.report.generating") : hasDraft ? t("aicontent.report.regen") : t("aicontent.report.generate", { year })}
          </Button>
        ) : <Alert tone="info">{t(ai.messageKey)}</Alert>}
        {stale && hasDraft ? <Alert tone="warn">{t("aicontent.report.stale")}</Alert> : null}
        {error ? <Alert>{error}</Alert> : null}
      </Card>

      {hasDraft ? (
        <Card className="animate-rise space-y-4 p-4">
          <Alert tone="warn" icon={<FileText className="h-4 w-4" />}>{t("aicontent.report.checkNote")}</Alert>
          <Field label={t("aicontent.report.titleLabel")}>
            <Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} maxLength={191} />
          </Field>
          {sections.map((s, i) => (
            <div key={i} className="space-y-2 rounded-control border border-line p-3">
              <div className="flex items-end gap-2">
                <Field label={t("aicontent.report.heading")} className="min-w-0 flex-1">
                  <Input value={s.heading} onChange={(e) => update(i, { heading: e.target.value })} maxLength={191} />
                </Field>
                <Button variant="ghost" className="h-11 w-11 shrink-0 px-0 text-danger" aria-label={t("aicontent.report.removeSection")}
                  onClick={() => { setSections((prev) => prev.filter((_, j) => j !== i)); setDirty(true); }}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <Field label={t("aicontent.report.body")}>
                <Textarea value={s.body} onChange={(e) => update(i, { body: e.target.value })} rows={Math.min(14, Math.max(4, Math.ceil(s.body.length / 70)))} maxLength={20_000} />
              </Field>
            </div>
          ))}
          <Button variant="secondary" className="w-full" onClick={() => { setSections((prev) => [...prev, { heading: "", body: "" }]); setDirty(true); }} disabled={sections.length >= 30}>
            <Plus className="h-4 w-4" aria-hidden /> {t("aicontent.report.addSection")}
          </Button>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button onClick={save} disabled={!!busy || !dirty}>{busy === "save" ? <Spinner /> : <Save className="h-4 w-4" aria-hidden />} {t("aicontent.report.save")}</Button>
            <Button variant="secondary" onClick={copy}><ClipboardCopy className="h-4 w-4" aria-hidden /> {t("aicontent.report.copy")}</Button>
            <Button variant="secondary" onClick={print}><Printer className="h-4 w-4" aria-hidden /> {t("aicontent.report.print")}</Button>
          </div>
          {dirty ? <p className="text-xs text-warn">{t("aicontent.report.unsaved")}</p> : <p className="text-xs text-ink-3">{t("aicontent.report.storedNote")}</p>}
        </Card>
      ) : null}
    </div>
  );
}
