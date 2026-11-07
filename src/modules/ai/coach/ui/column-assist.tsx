"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, Check, Sparkles, X } from "lucide-react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { useT } from "@/components/locale";
import { cn } from "@/lib/utils";
import { importAssistStateAction, suggestImportMappingAction } from "../actions";
import { maskSamples, ASSIST_MAX_COLUMNS, type AssistKind } from "../mask";
import { countChanges, type Confidence, type ValidatedMapping } from "../mapping";

type State = { ok: true } | { ok: false; messageKey: string } | null;

export type ColumnAssistProps<F extends string> = {
  kind: AssistKind;
  headers: string[];
  /** Alle Datenzeilen – gesendet werden nur die ersten drei, im Browser und auf dem Server maskiert */
  rows: string[][];
  mapping: readonly F[];
  /** Zielfelder mit Anzeigenamen (in der Sprache des Benutzers) */
  fields: ReadonlyArray<{ value: F; label: string }>;
  /** Vorschlag übernehmen (erst nach Bestätigung) */
  onApply: (mapping: F[], layout: "shots" | "totals" | null) => void;
  /** Zustand vom Server; ohne Angabe fragt die Komponente selbst nach (Import-Assistenten anderer Module) */
  state?: State;
  /** Aktueller Aufbau (nur Resultat-Import), für die Anzeige eines geänderten Aufbaus */
  layout?: "shots" | "totals";
  layoutLabels?: { shots: string; totals: string };
  className?: string;
};

const CONF_TONE: Record<Confidence, "ok" | "accent" | "warn"> = { high: "ok", medium: "accent", low: "warn" };

/**
 * «Spalten mit Claude zuordnen»: schlägt eine Zuordnung vor, die erst nach Bestätigung
 * übernommen wird. Gesendet werden nur Spaltennamen und drei maskierte Beispielzeilen.
 */
export function ColumnAssist<F extends string>({ kind, headers, rows, mapping, fields, onApply, state: given, layout, layoutLabels, className }: ColumnAssistProps<F>) {
  const t = useT();
  const [state, setState] = useState<State | undefined>(given);
  const [suggestion, setSuggestion] = useState<ValidatedMapping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (given !== undefined) return;
    let alive = true;
    importAssistStateAction(kind).then(
      (res) => { if (alive) setState(res.ok ? (res.data ?? null) : null); },
      () => { if (alive) setState(null); },
    );
    return () => { alive = false; };
  }, [given, kind]);

  const labelOf = useMemo(() => new Map<string, string>(fields.map((f) => [f.value, f.label])), [fields]);
  const current = given !== undefined ? given : state;
  if (!current) return null;

  const ask = () =>
    start(async () => {
      setError(null);
      setSuggestion(null);
      // Schon im Browser maskieren: Klarnamen, E-Mail und Telefon verlassen das Gerät nicht
      const masked = maskSamples(headers.slice(0, ASSIST_MAX_COLUMNS), rows, kind);
      const res = await suggestImportMappingAction({ kind, headers: masked.headers, rows: masked.rows });
      if (!res.ok) return setError(res.error);
      if (res.data) setSuggestion(res.data);
    });

  const accept = () => {
    if (!suggestion) return;
    const known = new Set(fields.map((f) => f.value as string));
    const next = headers.map((_, i) => {
      const f = suggestion.mapping[i] ?? "ignore";
      return (known.has(f) ? f : "ignore") as F;
    });
    onApply(next, suggestion.layout);
    setSuggestion(null);
  };

  const changes = suggestion ? countChanges(mapping, suggestion.mapping) : 0;
  const layoutChange = suggestion?.layout && layout && suggestion.layout !== layout ? suggestion.layout : null;

  return (
    <Card className={cn("animate-rise space-y-3 p-4", className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Sparkles className="h-4 w-4" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t("aicoach.map.title")}</p>
          <p className="text-xs text-ink-3">{t("aicoach.map.privacy")}</p>
        </div>
      </div>

      {!current.ok ? <Alert tone="info">{t(current.messageKey)}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}

      {current.ok && !suggestion ? (
        <Button variant="secondary" className="w-full" onClick={ask} disabled={pending || !headers.length}>
          {pending ? <><Spinner /> {t("aicoach.map.running")}</> : <><Sparkles className="h-4 w-4" aria-hidden /> {t("aicoach.map.run")}</>}
        </Button>
      ) : null}

      {suggestion ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-2">{changes || layoutChange ? t(changes === 1 ? "aicoach.map.changes.one" : "aicoach.map.changes.other", { n: changes }) : t("aicoach.map.same")}</p>
          {changes ? (
            <ul className="divide-y divide-line overflow-hidden rounded-control border border-line text-sm">
              {headers.map((h, i) => {
                const next = suggestion.mapping[i] ?? "ignore";
                const cur = mapping[i] ?? "ignore";
                if (next === cur) return null;
                const conf = suggestion.confidence[i];
                return (
                  <li key={i} className="px-3 py-2">
                    <div className="truncate font-medium">{h}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-ink-3 line-through">{labelOf.get(cur) ?? cur}</span>
                      <ArrowRight className="h-3 w-3 text-ink-3" aria-label={t("aicoach.map.becomes")} />
                      <span className="font-medium text-ink">{labelOf.get(next) ?? next}</span>
                      {conf ? <Badge tone={CONF_TONE[conf]}>{t(`aicoach.map.conf.${conf}`)}</Badge> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {layoutChange && layoutLabels ? <p className="text-sm text-ink-2">{t("aicoach.map.layout", { layout: layoutLabels[layoutChange] })}</p> : null}
          {suggestion.note ? <p className="rounded-control bg-surface-2 px-3 py-2 text-xs text-ink-2">{suggestion.note}</p> : null}
          <p className="text-[11px] text-ink-3">{t("aicoach.map.check")}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSuggestion(null)}><X className="h-4 w-4" aria-hidden /> {t("aicoach.map.discard")}</Button>
            <Button className="flex-1" onClick={accept} disabled={!changes && !layoutChange}><Check className="h-4 w-4" aria-hidden /> {t("aicoach.map.apply")}</Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
