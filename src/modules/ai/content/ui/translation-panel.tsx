"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Languages, RefreshCw, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { confirmDialog } from "@/components/ui/dialog";
import { toast, toastResult } from "@/components/ui/toaster";
import { useT } from "@/components/locale";
import { LOCALE_LABELS, type Locale } from "@/lib/i18n/core";
import { cn } from "@/lib/utils";
import { removeTranslationAction, saveTranslationAction, translateContentAction } from "../actions";
import { targetsLabel } from "../entities";
import type { EditorLocale, EditorState, TranslationProposal } from "../service";

type Draft = {
  values: Record<string, string>;
  hashes: Record<string, string>;
  /** Text des Vorschlags (zum Erkennen von Änderungen); null = bestehende Übersetzung bearbeiten */
  proposal: Record<string, string> | null;
};

function statusBadge(l: EditorLocale, draft: Draft | undefined, t: (k: string) => string) {
  if (draft?.proposal) return <Badge tone="accent">{t("aicontent.tr.status.proposal")}</Badge>;
  if (l.status === "fresh") return <Badge tone="ok">{t(l.reviewed ? "aicontent.tr.status.reviewed" : "aicontent.tr.status.fresh")}</Badge>;
  if (l.status === "stale") return <Badge tone="warn">{t("aicontent.tr.status.stale")}</Badge>;
  if (l.status === "partial") return <Badge tone="warn">{t("aicontent.tr.status.partial")}</Badge>;
  return <Badge tone="outline">{t("aicontent.tr.status.missing")}</Badge>;
}

/**
 * Übersetzungen eines Inhalts (Anlass, Mitteilung, Standordnung): mit Claude übersetzen, prüfen,
 * bearbeiten und erst dann veröffentlichen. Mitglieder sehen nur aktuelle Übersetzungen.
 */
export function TranslationPanel({ state, fieldLabels, title }: { state: EditorState; fieldLabels: Record<string, string>; title?: string }) {
  const t = useT();
  const router = useRouter();
  const [drafts, setDrafts] = useState<Partial<Record<Locale, Draft>>>({});
  const [open, setOpen] = useState<Locale | null>(null);
  const [failed, setFailed] = useState<Array<{ locale: Locale; messageKey: string }>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const hashes = useMemo(() => Object.fromEntries(state.fields.map((f) => [f.key, f.hash])), [state.fields]);
  const activeFields = state.fields.filter((f) => f.source);
  const pending = Object.entries(drafts).filter(([, d]) => d?.proposal) as Array<[Locale, Draft]>;

  function applyProposals(list: TranslationProposal[]) {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const p of list) next[p.locale] = { values: { ...p.fields }, hashes: { ...p.hashes }, proposal: { ...p.fields } };
      return next;
    });
    if (list.length === 1) setOpen(list[0]!.locale);
  }

  function translate(locales?: Locale[]) {
    setBusy(locales?.length === 1 ? `tr:${locales[0]}` : "tr");
    setFailed([]);
    start(async () => {
      const res = await translateContentAction({ entityType: state.entityType, entityId: state.entityId, locales });
      setBusy(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      applyProposals(res.data?.proposals ?? []);
      setFailed(res.data?.failed ?? []);
      toastResult(res);
    });
  }

  function edit(l: EditorLocale) {
    if (open === l.locale) return setOpen(null);
    setOpen(l.locale);
    if (!drafts[l.locale]) {
      setDrafts((prev) => ({ ...prev, [l.locale]: { values: Object.fromEntries(state.fields.map((f) => [f.key, l.fields[f.key]?.value ?? ""])), hashes, proposal: null } }));
    }
  }

  function setValue(locale: Locale, key: string, value: string) {
    setDrafts((prev) => {
      const d = prev[locale];
      return d ? { ...prev, [locale]: { ...d, values: { ...d.values, [key]: value } } } : prev;
    });
  }

  async function save(locale: Locale, d: Draft): Promise<boolean> {
    // Unverändert übernommener Vorschlag = AUTO, sonst von Hand geprüft
    const reviewed = !d.proposal || activeFields.some((f) => (d.values[f.key] ?? "").trim() !== (d.proposal?.[f.key] ?? "").trim());
    const res = await saveTranslationAction({ entityType: state.entityType, entityId: state.entityId, locale, values: d.values, hashes: d.hashes, reviewed });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[locale];
      return next;
    });
    return true;
  }

  function saveOne(locale: Locale) {
    const d = drafts[locale];
    if (!d) return;
    setBusy(`save:${locale}`);
    start(async () => {
      const done = await save(locale, d);
      setBusy(null);
      if (done) {
        toast.success(t("aicontent.tr.saved"));
        setOpen(null);
        router.refresh();
      }
    });
  }

  function saveAll() {
    setBusy("saveAll");
    start(async () => {
      let n = 0;
      for (const [locale, d] of pending) if (await save(locale, d)) n += 1;
      setBusy(null);
      if (n) {
        toast.success(t("aicontent.tr.savedAll", { n }));
        setOpen(null);
        router.refresh();
      }
    });
  }

  function discard(locale: Locale) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[locale];
      return next;
    });
    setOpen(null);
  }

  async function remove(locale: Locale) {
    if (!(await confirmDialog({ title: t("aicontent.tr.removeQ", { lang: LOCALE_LABELS[locale] }), message: t("aicontent.tr.removeText"), tone: "danger", confirmLabel: t("aicontent.tr.remove") }))) return;
    setBusy(`rm:${locale}`);
    start(async () => {
      const res = await removeTranslationAction({ entityType: state.entityType, entityId: state.entityId, locale });
      setBusy(null);
      toastResult(res);
      if (res.ok) {
        discard(locale);
        router.refresh();
      }
    });
  }

  if (!activeFields.length) return null;

  return (
    <Card className="animate-rise space-y-4 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Languages className="h-4 w-4" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{title ?? t("aicontent.tr.title")}</h2>
          <p className="text-sm text-ink-3">{t("aicontent.tr.intro", { lang: LOCALE_LABELS[state.sourceLocale] })}</p>
        </div>
      </div>

      {state.ai.ok ? (
        <Button variant="secondary" className="w-full" onClick={() => translate()} disabled={!!busy}>
          {busy === "tr" ? <Spinner /> : <Languages className="h-4 w-4" aria-hidden />}
          {busy === "tr" ? t("aicontent.tr.translating") : t("aicontent.tr.button", { targets: targetsLabel(state.sourceLocale) })}
        </Button>
      ) : (
        <Alert tone="info">{t(state.ai.messageKey)}</Alert>
      )}

      {failed.length ? (
        <Alert tone="warn">{failed.map((f) => `${LOCALE_LABELS[f.locale]}: ${t(f.messageKey)}`).join(" · ")}</Alert>
      ) : null}

      <ul className="divide-y divide-line rounded-control border border-line">
        {state.locales.map((l) => {
          const d = drafts[l.locale];
          const isOpen = open === l.locale;
          const hasSaved = l.status !== "missing";
          return (
            <li key={l.locale}>
              <div className="flex min-h-14 items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => edit(l)} aria-expanded={isOpen}
                  className="press flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left">
                  <span className="w-8 shrink-0 text-sm font-semibold uppercase text-ink-3">{l.locale}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{LOCALE_LABELS[l.locale]}</span>
                  {statusBadge(l, d, t)}
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-3 transition-transform", isOpen && "rotate-180")} aria-hidden />
                </button>
              </div>
              {isOpen && d ? (
                <div className="space-y-3 border-t border-line bg-surface-2/50 px-3 py-3">
                  {l.status === "stale" && !d.proposal ? <p className="text-sm text-warn">{t("aicontent.tr.staleHint")}</p> : null}
                  {d.proposal ? <p className="text-sm text-ink-3">{t("aicontent.tr.proposalHint")}</p> : null}
                  {activeFields.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Field label={fieldLabels[f.key] ?? f.key}>
                        {f.multiline ? (
                          <Textarea value={d.values[f.key] ?? ""} onChange={(e) => setValue(l.locale, f.key, e.target.value)} rows={8} maxLength={f.max} className="text-sm" />
                        ) : (
                          <Input value={d.values[f.key] ?? ""} onChange={(e) => setValue(l.locale, f.key, e.target.value)} maxLength={f.max} />
                        )}
                      </Field>
                      <details className="text-xs text-ink-3">
                        <summary className="flex min-h-11 cursor-pointer items-center">{t("aicontent.tr.showSource")}</summary>
                        <p className="whitespace-pre-line break-words rounded-control bg-surface p-2 text-ink-2">{f.source}</p>
                      </details>
                    </div>
                  ))}
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button onClick={() => saveOne(l.locale)} disabled={!!busy}>
                      {busy === `save:${l.locale}` ? <Spinner /> : <Check className="h-4 w-4" aria-hidden />}
                      {d.proposal ? t("aicontent.tr.publish") : t("aicontent.tr.saveEdit")}
                    </Button>
                    {state.ai.ok ? (
                      <Button variant="secondary" onClick={() => translate([l.locale])} disabled={!!busy}>
                        {busy === `tr:${l.locale}` ? <Spinner /> : <RefreshCw className="h-4 w-4" aria-hidden />} {t("aicontent.tr.retranslate")}
                      </Button>
                    ) : null}
                    {d.proposal ? (
                      <Button variant="ghost" onClick={() => discard(l.locale)} disabled={!!busy}>{t("aicontent.tr.discard")}</Button>
                    ) : hasSaved ? (
                      <Button variant="ghost" className="text-danger" onClick={() => remove(l.locale)} disabled={!!busy}>
                        {busy === `rm:${l.locale}` ? <Spinner /> : <Trash2 className="h-4 w-4" aria-hidden />} {t("aicontent.tr.remove")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {pending.length > 1 ? (
        <Button className="w-full" onClick={saveAll} disabled={!!busy}>
          {busy === "saveAll" ? <Spinner /> : <Check className="h-4 w-4" aria-hidden />} {t("aicontent.tr.publishAll", { n: pending.length })}
        </Button>
      ) : null}
      <p className="text-xs text-ink-3">{t("aicontent.tr.footer")}</p>
    </Card>
  );
}
