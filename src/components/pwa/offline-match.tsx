"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CloudOff, ExternalLink } from "lucide-react";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { APP_TZ } from "@/lib/time";
import { disciplineLabel, scoringModeLabel } from "@/modules/scores/types";
import { ScoreEntry } from "@/modules/scores/ui/score-entry";
import { useSyncEvents, useSyncStatus } from "@/lib/offline/hooks";
import { getMatchEntry } from "@/lib/offline/store";
import type { MatchEntry, ScoreMatch, SyncEvent } from "@/lib/offline/types";

type State = { status: "loading" } | { status: "missing" } | { status: "ready"; entry: MatchEntry; view: ScoreMatch; redirectTo: string | null };

/** Lokale Schüsse in die Ansicht übernehmen (vermeidet Flackern beim Laden). */
function viewFromEntry(entry: MatchEntry): ScoreMatch {
  return {
    ...entry.view,
    status: entry.status,
    participants: entry.view.participants.map((p) => ({
      ...p,
      results: entry.view.program.stages.map((_, i) => {
        const shots = entry.shots[p.id]?.[i] ?? p.results.find((r) => r.stageIndex === i)?.shots ?? [];
        return { stageIndex: i, shots, total: Math.round(shots.reduce((a, b) => a + b, 0) * 10) / 10 };
      }),
    })),
  };
}

async function load(key: string): Promise<State> {
  try {
    const entry = await getMatchEntry(key);
    if (!entry) return { status: "missing" };
    if (entry.serverId) {
      // Bereits übertragen: Server-Eintrag anzeigen bzw. zur Online-Ansicht wechseln
      const server = await getMatchEntry(`s:${entry.serverId}`);
      if (!server) return { status: "missing" };
      return { status: "ready", entry: server, view: viewFromEntry(server), redirectTo: `/scores/matches/${entry.serverId}` };
    }
    return { status: "ready", entry, view: viewFromEntry(entry), redirectTo: key.startsWith("s:") ? `/scores/matches/${key.slice(2)}` : null };
  } catch {
    return { status: "missing" };
  }
}

/** Durchgang aus IndexedDB anzeigen und bearbeiten – funktioniert ohne Server. */
export function OfflineMatch() {
  const params = useSearchParams();
  const key = params.get("key") ?? "";
  const { online } = useSyncStatus();
  const [state, setState] = useState<State>({ status: "loading" });
  // Aktueller Status aus der Eingabe (abschliessen / wieder öffnen), damit die Kopfzeile mitzieht
  const [liveStatus, setLiveStatus] = useState<{ key: string; status: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void load(key).then((s) => {
      if (cancelled) return;
      // Offline erstellter Durchgang wurde übertragen: zur normalen Ansicht wechseln
      if (s.status === "ready" && key.startsWith("c:") && s.redirectTo && navigator.onLine) {
        window.location.replace(s.redirectTo);
        return;
      }
      setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const onEvent = useCallback(
    (ev: SyncEvent) => {
      if (ev.type === "mapped" && key === `c:${ev.clientId}` && navigator.onLine) {
        window.location.replace(`/scores/matches/${ev.matchId}`);
      }
    },
    [key],
  );
  useSyncEvents(onEvent);

  if (state.status === "loading") {
    return <div className="space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-40" /></div>;
  }
  if (state.status === "missing") {
    return (
      <EmptyState
        icon={<CloudOff className="h-5 w-5" />}
        title="Durchgang nicht gefunden"
        text="Dieser Durchgang ist auf diesem Gerät nicht gespeichert. Mit Internetverbindung findest du ihn unter «Schiessen»."
        action={<a href="/offline" className="press inline-flex h-11 items-center rounded-control bg-ink px-4 font-medium text-bg">Zur Übersicht</a>}
      />
    );
  }

  const { entry, view, redirectTo } = state;
  const notSynced = entry.key.startsWith("c:");
  const status = liveStatus?.key === entry.key ? liveStatus.status : view.status;
  return (
    <div>
      <div className="animate-fade mb-5">
        <a href="/offline" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink mb-2"><span aria-hidden>←</span> Übersicht</a>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">{view.title ?? view.program.name}</h1>
            <p className="text-ink-3 text-sm mt-1">
              {formatDate(view.date, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: APP_TZ })}{view.locationNote ? ` · ${view.locationNote}` : ""}{view.createdByName ? ` · erstellt von ${view.createdByName}` : ""}
            </p>
          </div>
          {notSynced ? <Badge tone="warn">Nur auf Gerät</Badge> : status === "FINISHED" ? <Badge tone="ok">Abgeschlossen</Badge> : <Badge tone="accent">Offen</Badge>}
        </div>
      </div>
      <div className="animate-fade flex flex-wrap gap-1.5 mb-4 -mt-2">
        {view.title ? <Badge>{view.program.name}</Badge> : null}
        <Badge tone="outline">{disciplineLabel(view.program.discipline)}</Badge>
        <Badge tone="outline">{view.program.totals.shots} Schuss · max. {view.program.totals.max}</Badge>
        <Badge tone="outline">{scoringModeLabel(view.program.scoringMode, true)}</Badge>
      </div>
      {online && redirectTo ? (
        <a href={redirectTo} className="animate-fade mb-4 flex items-center gap-2 rounded-control bg-ok/10 px-3.5 py-2.5 text-sm text-ok">
          <ExternalLink className="h-4 w-4" /> Verbindung ist zurück – zur Online-Ansicht wechseln
        </a>
      ) : null}
      <ScoreEntry match={view} storageKey={entry.key} tenantId={entry.tenantId} userId={entry.userId} persistView={false} onStatusChange={(s) => setLiveStatus({ key: entry.key, status: s })} />
    </div>
  );
}
