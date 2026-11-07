"use client";

import { useState, useTransition } from "react";
import { Dumbbell, RefreshCw, Sparkles, ThumbsUp, Crosshair } from "lucide-react";
import { Alert, Button, Card } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { useT } from "@/components/locale";
import { runCoachAction } from "../actions";
import type { CoachResult } from "../prompt";

export type CoachCardProps = {
  state: { ok: true } | { ok: false; messageKey: string };
  cached: CoachResult | null;
  stale: boolean;
  matchCount: number;
};

/**
 * Karte «Auswertung mit Claude» auf /scores/stats: fasst die eigenen letzten Resultate zusammen
 * (Stärken, Schwerpunkte, Trainingsvorschlag). Pro Tag gespeichert; neu nur bei neuen Resultaten.
 */
export function CoachCard({ state, cached, stale, matchCount }: CoachCardProps) {
  const t = useT();
  const plural = (key: string, n: number) => t(`${key}.${n === 1 ? "one" : "other"}`, { n });
  const [result, setResult] = useState<CoachResult | null>(cached);
  const [isStale, setStale] = useState(stale);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setError(null);
      const res = await runCoachAction();
      if (!res.ok) return setError(res.error);
      if (res.data) {
        setResult(res.data);
        setStale(false);
      }
    });

  return (
    <Card className="animate-rise overflow-hidden" aria-busy={pending}>
      <div className="flex items-start gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Sparkles className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{t("aicoach.coach.title")}</h2>
          <p className="text-xs text-ink-3">{t("aicoach.coach.subtitle")}</p>
        </div>
      </div>

      <div className="space-y-3 border-t border-line p-4">
        {!state.ok ? (
          <Alert tone="info">{t(state.messageKey)}</Alert>
        ) : result ? (
          <CoachResultView result={result} />
        ) : matchCount === 0 ? (
          <p className="text-sm text-ink-3">{t("aicoach.coach.noData")}</p>
        ) : (
          <p className="text-sm text-ink-2">{plural("aicoach.coach.intro", matchCount)}</p>
        )}

        {error ? <Alert>{error}</Alert> : null}

        {state.ok && matchCount > 0 && (!result || isStale) ? (
          <div className="space-y-2">
            {result && isStale ? <p className="text-xs text-ink-3">{t("aicoach.coach.staleHint")}</p> : null}
            <Button className="w-full sm:w-auto" onClick={run} disabled={pending} variant={result ? "secondary" : "primary"}>
              {pending ? <><Spinner /> {t("aicoach.coach.running")}</> : result ? <><RefreshCw className="h-4 w-4" aria-hidden /> {t("aicoach.coach.refresh")}</> : <><Sparkles className="h-4 w-4" aria-hidden /> {t("aicoach.coach.run")}</>}
            </Button>
          </div>
        ) : null}

        {state.ok ? (
          <p className="text-[11px] text-ink-3">
            {result ? `${plural("aicoach.coach.basedOn", result.matchCount)} ` : ""}
            {t("aicoach.coach.privacy")} {t("aicoach.coach.disclaimer")}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function CoachResultView({ result }: { result: CoachResult }) {
  const t = useT();
  return (
    <div className="space-y-4 text-sm">
      <p className="whitespace-pre-line text-ink">{result.summary}</p>
      {result.strengths.length ? (
        <Section icon={<ThumbsUp className="h-4 w-4 text-ok" aria-hidden />} title={t("aicoach.coach.strengths")}>
          <ul className="list-disc space-y-1 pl-5 text-ink-2">{result.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </Section>
      ) : null}
      {result.focus.length ? (
        <Section icon={<Crosshair className="h-4 w-4 text-accent" aria-hidden />} title={t("aicoach.coach.focus")}>
          <ul className="list-disc space-y-1 pl-5 text-ink-2">{result.focus.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </Section>
      ) : null}
      {result.training.steps.length ? (
        <Section icon={<Dumbbell className="h-4 w-4 text-ink-2" aria-hidden />} title={t("aicoach.coach.training")}>
          <div className="rounded-control bg-surface-2 p-3">
            {result.training.title ? <p className="font-medium text-ink">{result.training.title}</p> : null}
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-ink-2">{result.training.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">{icon} {title}</h3>
      {children}
    </section>
  );
}
