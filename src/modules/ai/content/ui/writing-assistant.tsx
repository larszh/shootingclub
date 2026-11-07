"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Sparkles, Wand2, X } from "lucide-react";
import { Alert, Button, Card, Field, Textarea } from "@/components/ui";
import { Segmented } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import { useT } from "@/components/locale";
import { cn } from "@/lib/utils";
import { draftTextAction, improveTextAction } from "../actions";
import type { EventFacts, WritingKind, WritingTone } from "../prompts";

export type WritingAvailability = { ok: true } | { ok: false; messageKey: string };

type Preview = { title: string; text: string; changes: string[]; mode: "draft" | "improve" };

/**
 * Schreibhilfe im Editor: aus Stichworten einen Entwurf erstellen oder den Text verbessern.
 * Das Ergebnis erscheint als Vorschau; erst «Übernehmen» füllt das Formular. Nichts wird veröffentlicht.
 */
export function WritingAssistant({ kind, availability, getCurrent, getFacts, onApply }: {
  kind: WritingKind;
  availability: WritingAvailability;
  getCurrent: () => { title: string; text: string };
  getFacts?: () => EventFacts;
  onApply: (v: { title: string; text: string }) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"draft" | "improve">("draft");
  const [notes, setNotes] = useState("");
  const [tone, setTone] = useState<WritingTone>("friendly");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setError(null);
    const cur = getCurrent();
    if (mode === "draft" && notes.trim().length < 3) return setError(t("aicontent.write.notesMissing"));
    if (mode === "improve" && cur.text.trim().length < 3) return setError(t("aicontent.write.textMissing"));
    start(async () => {
      if (mode === "draft") {
        const facts = getFacts?.();
        const res = await draftTextAction({ kind, tone, notes, title: cur.title.slice(0, 191) || undefined, facts: facts ? clean(facts) : undefined });
        if (!res.ok) return setError(res.error);
        if (res.data) setPreview({ ...res.data, changes: [], mode });
      } else {
        const res = await improveTextAction({ kind, title: cur.title.slice(0, 191), text: cur.text.slice(0, 5000) });
        if (!res.ok) return setError(res.error);
        if (res.data) setPreview({ ...res.data, mode });
      }
    });
  }

  function accept() {
    if (!preview) return;
    onApply({ title: preview.title, text: preview.text });
    setPreview(null);
    toast.success(t("aicontent.write.applied"));
  }

  return (
    <Card className="animate-rise overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="press flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Sparkles className="h-4 w-4" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{t("aicontent.write.title")}</span>
          <span className="block text-xs text-ink-3">{t("aicontent.write.subtitle")}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="space-y-4 border-t border-line p-4">
          {!availability.ok ? (
            <Alert tone="info">{t(availability.messageKey)}</Alert>
          ) : preview ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{t("aicontent.write.preview")}</p>
              <div className="rounded-control border border-line bg-surface-2 p-3">
                {preview.title ? <p className="font-semibold">{preview.title}</p> : null}
                <p className="mt-1 whitespace-pre-line break-words text-sm text-ink-2">{preview.text}</p>
              </div>
              {preview.changes.length ? (
                <div>
                  <p className="text-sm font-medium">{t("aicontent.write.changes")}</p>
                  <ul className="list-disc pl-5 text-sm text-ink-2">{preview.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
              ) : preview.mode === "improve" ? <p className="text-sm text-ink-3">{t("aicontent.write.noChanges")}</p> : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={accept}><Check className="h-4 w-4" aria-hidden /> {t("aicontent.write.accept")}</Button>
                <Button variant="ghost" onClick={() => setPreview(null)}><X className="h-4 w-4" aria-hidden /> {t("aicontent.write.discard")}</Button>
              </div>
              <p className="text-xs text-ink-3">{t("aicontent.write.checkNote")}</p>
            </div>
          ) : (
            <>
              <Segmented label={t("aicontent.write.mode")} value={mode} onChange={(v) => { setMode(v); setError(null); }}
                options={[{ value: "draft", label: t("aicontent.write.modeDraft") }, { value: "improve", label: t("aicontent.write.modeImprove") }]} />
              {mode === "draft" ? (
                <>
                  <Field label={t("aicontent.write.notes")} hint={t("aicontent.write.notesHint")}>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} rows={5} placeholder={t(kind === "event" ? "aicontent.write.notesPhEvent" : "aicontent.write.notesPhNews")} />
                  </Field>
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-ink-2">{t("aicontent.write.tone")}</p>
                    <Segmented label={t("aicontent.write.tone")} value={tone} onChange={setTone}
                      options={[{ value: "factual", label: t("aicontent.write.tone.factual") }, { value: "friendly", label: t("aicontent.write.tone.friendly") }, { value: "short", label: t("aicontent.write.tone.short") }]} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-3">{t("aicontent.write.improveHint")}</p>
              )}
              {error ? <Alert>{error}</Alert> : null}
              <Button className="w-full" onClick={run} disabled={pending}>
                {pending ? <Spinner /> : mode === "draft" ? <Sparkles className="h-4 w-4" aria-hidden /> : <Wand2 className="h-4 w-4" aria-hidden />}
                {pending ? t("aicontent.write.working") : mode === "draft" ? t("aicontent.write.runDraft") : t("aicontent.write.runImprove")}
              </Button>
              <p className="text-xs text-ink-3">{t("aicontent.write.privacy")}</p>
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function clean(f: EventFacts) {
  const out: { kind?: string; date?: string; time?: string; location?: string } = {};
  if (f.kind) out.kind = f.kind.slice(0, 40);
  if (f.date) out.date = f.date.slice(0, 40);
  if (f.time) out.time = f.time.slice(0, 40);
  if (f.location) out.location = f.location.slice(0, 191);
  return out;
}
