"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, CloudOff, Delete, Loader2, Lock, Trash2, Trophy, Unlock } from "lucide-react";
import { deleteMatchAction, saveStageResultAction, setMatchStatusAction } from "@/modules/scores/actions";
import { positionLabel, stageTotal } from "@/modules/scores/types";
import { Alert, Button, Card } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { cn, formatScore } from "@/lib/utils";
import { useSyncEvents, useSyncStatus } from "@/lib/offline/hooks";
import { requestFlush } from "@/lib/offline/outbox";
import { discardMatch, getMatchEntry, recordShots, recordStatus, upsertServerView } from "@/lib/offline/store";
import { cellKey, type ScoreMatch, type SyncEvent } from "@/lib/offline/types";
import { StageTimer } from "./stage-timer";

type CellState = Record<string, number>;

function omit<T extends Record<string, unknown>>(obj: T, key: string): T {
  if (!(key in obj)) return obj;
  const next = { ...obj };
  delete next[key];
  return next;
}

/** Gerätezeit für last-write-wins (nur in Event-Handlern aufrufen). */
function clientNow() {
  return Date.now();
}

function tap() {
  try {
    navigator.vibrate?.(10);
  } catch {
    // nicht unterstützt
  }
}

/**
 * Resultat-Eingabe, offline-fähig: Jeder Schuss wird sofort in IndexedDB gespeichert und
 * über die Outbox an den Server übertragen (sofort, wenn online; sonst bei Wiederverbindung).
 *
 * `storageKey`: "s:<matchId>" für Server-Durchgänge, "c:<clientId>" für offline erstellte.
 */
export function ScoreEntry({ match, storageKey, tenantId, userId, persistView = true }: { match: ScoreMatch; storageKey: string; tenantId: string; userId: string; /** Serveransicht in IndexedDB ablegen (false, wenn die Ansicht selbst aus IndexedDB stammt) */ persistView?: boolean }) {
  const router = useRouter();
  const { online } = useSyncStatus();
  const decimal = match.program.scoringMode === "RINGS_DECIMAL";
  const hits = match.program.scoringMode === "HITS";
  const stages = match.program.stages;
  const isServerMatch = storageKey.startsWith("s:") && !!match.id;

  // Lokaler Zustand: shots[participantId][stageIndex]
  const [shots, setShots] = useState<Record<string, number[][]>>(() =>
    Object.fromEntries(match.participants.map((p) => [p.id, stages.map((_, i) => p.results.find((r) => r.stageIndex === i)?.shots ?? [])])),
  );
  const [status, setStatus] = useState(match.status);
  const finished = status === "FINISHED";
  const [activeP, setActiveP] = useState(match.participants.find((p) => p.isMe)?.id ?? match.participants[0]!.id);
  const [activeS, setActiveS] = useState(() => {
    const p = match.participants.find((x) => x.isMe) ?? match.participants[0]!;
    const idx = stages.findIndex((st, i) => (p.results.find((r) => r.stageIndex === i)?.shots.length ?? 0) < st.shots);
    return idx === -1 ? 0 : idx;
  });
  const [dirty, setDirty] = useState<CellState>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [decimalBuffer, setDecimalBuffer] = useState("");
  const [pending, start] = useTransition();
  const touched = useRef(new Set<string>());
  const directTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const stage = stages[activeS]!;
  const current = shots[activeP]?.[activeS] ?? [];
  const participant = match.participants.find((p) => p.id === activeP)!;
  const ctx = useMemo(() => ({ storageKey, view: match, tenantId, userId }), [storageKey, match, tenantId, userId]);

  // Lokalen Stand laden (z.B. Seite aus dem Offline-Cache oder ungesicherte Eingaben nach Neuladen)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entry = isServerMatch && persistView ? await upsertServerView(match, tenantId, userId) : await getMatchEntry(storageKey);
        if (cancelled || !entry || entry.serverId) return;
        setShots((prev) => {
          const next: Record<string, number[][]> = {};
          for (const p of match.participants) {
            const local = entry.shots[p.id];
            next[p.id] = stages.map((_, i) => (touched.current.has(cellKey(p.id, i)) ? (prev[p.id]?.[i] ?? []) : (local?.[i] ?? prev[p.id]?.[i] ?? [])));
          }
          return next;
        });
        setDirty((d) => ({ ...entry.dirty, ...d }));
        if (entry.statusDirty) setStatus(entry.status);
      } catch {
        // IndexedDB nicht verfügbar: Serverstand bleibt
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isServerMatch, persistView, match, stages, storageKey, tenantId, userId]);

  useEffect(() => {
    const timers = directTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  // Bestätigungen und Fehler der Synchronisierung
  const onSyncEvent = useCallback(
    (ev: SyncEvent) => {
      if (ev.type !== "acked" && ev.type !== "failed") return;
      const op = ev.op;
      if (op.originKey !== storageKey) return;
      if (op.type === "saveStageResult") {
        const pk = op.uiParticipantKey ?? op.payload.participantKey;
        const ck = cellKey(pk, op.payload.stageIndex);
        if (ev.type === "acked") {
          setDirty((d) => (d[ck] !== undefined && d[ck]! <= op.payload.clientUpdatedAt ? omit(d, ck) : d));
          setFailed((f) => omit(f, ck));
          setSaved((s) => (s[pk] ? s : { ...s, [pk]: true }));
        } else {
          setFailed((f) => ({ ...f, [ck]: ev.result.error ?? "Fehler" }));
        }
      } else if (op.type === "setMatchStatus") {
        if (ev.type === "failed") setNotice(ev.result.error ?? "Status konnte nicht gespeichert werden.");
        else if (isServerMatch) router.refresh();
      }
    },
    [storageKey, isServerMatch, router],
  );
  useSyncEvents(onSyncEvent);

  /** Fallback ohne IndexedDB (z.B. gesperrter Speicher): direkt per Server Action speichern. */
  const persistDirect = (participantId: string, stageIndex: number, list: number[], ts: number) => {
    if (!isServerMatch || !match.id) {
      setNotice("Lokales Speichern ist auf diesem Gerät nicht möglich.");
      return;
    }
    const ck = cellKey(participantId, stageIndex);
    clearTimeout(directTimers.current[ck]);
    directTimers.current[ck] = setTimeout(async () => {
      try {
        const res = await saveStageResultAction({ matchId: match.id!, participantId, stageIndex, shots: list, clientUpdatedAt: ts });
        if (res.ok) {
          setDirty((d) => (d[ck] !== undefined && d[ck]! <= ts ? omit(d, ck) : d));
          setSaved((s) => ({ ...s, [participantId]: true }));
        } else setFailed((f) => ({ ...f, [ck]: res.error }));
      } catch {
        setFailed((f) => ({ ...f, [ck]: "Keine Verbindung" }));
      }
    }, 500);
  };

  const setCurrent = (list: number[]) => {
    const ts = clientNow();
    const pId = activeP;
    const sIdx = activeS;
    const ck = cellKey(pId, sIdx);
    touched.current.add(ck);
    setShots((s) => ({ ...s, [pId]: (s[pId] ?? stages.map(() => [])).map((arr, i) => (i === sIdx ? list : arr)) }));
    setDirty((d) => ({ ...d, [ck]: ts }));
    setFailed((f) => omit(f, ck));
    // Write-through: sofort dauerhaft lokal speichern und Übertragung einreihen
    recordShots(ctx, pId, sIdx, list, ts)
      .then(() => requestFlush())
      .catch(() => persistDirect(pId, sIdx, list, ts));
  };

  const addShot = (v: number) => {
    if (finished || current.length >= stage.shots) return;
    const next = [...current, v];
    setCurrent(next);
    // Serie voll: automatisch zur nächsten unvollständigen Serie springen
    if (next.length >= stage.shots) {
      const nextIdx = stages.findIndex((st, i) => i > activeS && (shots[activeP]?.[i]?.length ?? 0) < st.shots);
      if (nextIdx !== -1) setTimeout(() => setActiveS(nextIdx), 350);
    }
  };
  const undo = () => {
    if (finished) return;
    if (decimal && decimalBuffer) return setDecimalBuffer("");
    if (current.length === 0) return;
    setCurrent(current.slice(0, -1));
  };
  const pushDecimal = (ch: string) => {
    if (ch === ".") {
      if (decimalBuffer.includes(".") || decimalBuffer === "") return;
      return setDecimalBuffer(decimalBuffer + ".");
    }
    const next = decimalBuffer + ch;
    // Vollständig, sobald eine Nachkommastelle da ist oder zwei Stellen vor dem Punkt (10)
    if (next.includes(".")) {
      if (next.split(".")[1]!.length >= 1) {
        const n = Number(next);
        setDecimalBuffer("");
        if (n <= stage.maxPerShot + 0.9) addShot(n);
      } else setDecimalBuffer(next);
    } else if (Number(next) > stage.maxPerShot || next.length >= 2) {
      // "10" → 10.0 direkt übernehmen, wenn kein Punkt kommt
      if (Number(next) <= stage.maxPerShot) setDecimalBuffer(next);
      else setDecimalBuffer("");
    } else setDecimalBuffer(next);
  };
  const commitDecimalBuffer = () => {
    if (!decimalBuffer) return;
    const n = Number(decimalBuffer);
    setDecimalBuffer("");
    if (Number.isFinite(n) && n <= stage.maxPerShot + 0.9) addShot(n);
  };

  const toggleStatus = () => {
    const next = finished ? "OPEN" : "FINISHED";
    const ts = clientNow();
    setNotice(null);
    setStatus(next);
    // Über die Outbox, damit der Status erst nach allen ausstehenden Schüssen gesetzt wird
    recordStatus(ctx, next, ts)
      .then(() => requestFlush(0))
      .catch(() => {
        if (!isServerMatch || !match.id) return setNotice("Status konnte lokal nicht gespeichert werden.");
        start(async () => {
          try {
            const res = await setMatchStatusAction(match.id!, next);
            if (!res.ok) setNotice(res.error);
            router.refresh();
          } catch {
            setStatus(finished ? "FINISHED" : "OPEN");
            setNotice("Keine Verbindung. Bitte später nochmals versuchen.");
          }
        });
      });
  };

  const remove = async () => {
    if (!(await confirmDialog({ title: "Durchgang wirklich löschen?", tone: "danger" }))) return;
    setNotice(null);
    let serverId = isServerMatch ? match.id : null;
    if (!isServerMatch) {
      const entry = await getMatchEntry(storageKey).catch(() => undefined);
      serverId = entry?.serverId ?? null;
      if (!serverId) {
        // Noch nicht übertragen: nur lokal verwerfen
        await discardMatch(storageKey).catch(() => undefined);
        window.location.assign(navigator.onLine ? "/scores" : "/offline");
        return;
      }
    }
    if (!navigator.onLine) {
      setNotice("Löschen ist nur mit Internetverbindung möglich.");
      return;
    }
    start(async () => {
      // Lokale Kopie samt ausstehender Eingaben verwerfen: der Durchgang existiert danach nicht mehr
      await discardMatch(storageKey).catch(() => undefined);
      try {
        // Bei Erfolg leitet die Server Action auf /scores um; zurück kommt nur ein Fehler
        const res = await deleteMatchAction(serverId!);
        if (res && !res.ok) {
          setNotice(res.error);
          router.refresh();
        }
      } catch (e) {
        unstable_rethrow(e); // Weiterleitung nach erfolgreichem Löschen
        setNotice("Keine Verbindung. Bitte später nochmals versuchen.");
        router.refresh();
      }
    });
  };

  const totals = useMemo(
    () =>
      Object.fromEntries(
        match.participants.map((p) => [p.id, { total: Math.round((shots[p.id] ?? []).reduce((a, arr) => a + stageTotal(arr), 0) * 10) / 10, stages: (shots[p.id] ?? []).map(stageTotal) }]),
      ),
    [shots, match.participants],
  );
  const leader = match.participants.reduce<{ id: string; total: number } | null>((best, p) => {
    const t = totals[p.id]!.total;
    return !best || t > best.total ? { id: p.id, total: t } : best;
  }, null);

  const keypadValues = useMemo(() => {
    const max = Math.min(stage.maxPerShot, 12);
    return Array.from({ length: max + 1 }, (_, i) => max - i);
  }, [stage.maxPerShot]);

  /** Speicherstand pro Teilnehmer */
  const participantState = (pid: string): "failed" | "pending" | "saved" | null => {
    const prefix = `${pid}|`;
    if (Object.keys(failed).some((k) => k.startsWith(prefix))) return "failed";
    if (Object.keys(dirty).some((k) => k.startsWith(prefix))) return "pending";
    return saved[pid] ? "saved" : null;
  };
  const activeCell = cellKey(activeP, activeS);

  return (
    <div className="space-y-5">
      {/* Stand */}
      <Card className="animate-rise overflow-hidden">
        <div className="divide-y divide-line">
          {match.participants.map((p) => {
            const t = totals[p.id]!;
            const isLeader = finished && leader?.id === p.id && match.participants.length > 1;
            const st = participantState(p.id);
            return (
              <button key={p.id} type="button" onClick={() => setActiveP(p.id)}
                className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors", activeP === p.id ? "bg-surface-2" : "hover:bg-surface-2/60")}>
                <Avatar name={p.name} src={p.avatarUrl} size={40} tone={p.isGuest ? "guest" : "ink"} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-medium truncate">{p.name}{isLeader ? <Trophy className="h-4 w-4 text-accent" /> : null}{p.isMe ? <span className="text-xs text-ink-3">(du)</span> : null}</span>
                  <span className="flex gap-1 mt-1 flex-wrap">
                    {t.stages.map((sv, i) => (
                      <span key={i} className={cn("rounded-md px-1.5 py-0.5 text-[11px] tabular-nums", (shots[p.id]?.[i]?.length ?? 0) >= stages[i]!.shots ? "bg-ink/10 text-ink" : "bg-surface-2 text-ink-3")}>{formatScore(sv, decimal)}</span>
                    ))}
                  </span>
                  {st ? (
                    <span className={cn("mt-1 flex items-center gap-1 text-[11px]", st === "failed" ? "text-accent" : st === "pending" ? (online ? "text-ink-3" : "text-warn") : "text-ok")}>
                      {st === "failed" ? <><AlertTriangle className="h-3 w-3" /> nicht gespeichert</>
                        : st === "pending" ? (online ? <><Loader2 className="h-3 w-3 animate-spin" /> wird gespeichert…</> : <><CloudOff className="h-3 w-3" /> wartet auf Verbindung</>)
                        : <><Check className="h-3 w-3" /> gespeichert</>}
                    </span>
                  ) : null}
                </span>
                <span className="text-right">
                  <span className="block text-2xl font-semibold tabular-nums leading-none">{formatScore(t.total, decimal)}</span>
                  <span className="block text-[11px] text-ink-3 mt-1">von {match.program.totals.max}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Serien-Navigation */}
      <div className="animate-rise [animation-delay:60ms]">
        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={() => setActiveS((s) => Math.max(0, s - 1))} disabled={activeS === 0} aria-label="Vorherige Serie" className="press h-11 w-11 rounded-full hover:bg-surface-2 disabled:opacity-30 flex items-center justify-center"><ChevronLeft className="h-5 w-5" /></button>
          <div className="text-center">
            <div className="font-semibold">{stage.name}</div>
            <div className="text-xs text-ink-3">{stage.distanceM} m · {stage.shots} Schuss{stage.position ? ` · ${positionLabel(stage.position)}` : ""}{stage.timeLimitSec ? ` · ${stage.timeLimitSec} s` : ""}</div>
            {stage.note ? <div className="text-xs text-ink-3 mt-0.5">{stage.note}</div> : null}
          </div>
          <button type="button" onClick={() => setActiveS((s) => Math.min(stages.length - 1, s + 1))} disabled={activeS === stages.length - 1} aria-label="Nächste Serie" className="press h-11 w-11 rounded-full hover:bg-surface-2 disabled:opacity-30 flex items-center justify-center"><ChevronRight className="h-5 w-5" /></button>
        </div>
        <div className="flex gap-1 justify-center">
          {stages.map((st, i) => {
            const done = (shots[activeP]?.[i]?.length ?? 0) >= st.shots;
            return <button key={i} type="button" onClick={() => setActiveS(i)} aria-label={st.name} className={cn("h-1.5 rounded-full transition-all", i === activeS ? "w-6 bg-ink" : done ? "w-3 bg-ink/40" : "w-3 bg-line")} />;
          })}
        </div>
      </div>

      {/* Zeitnehmung */}
      {!finished ? <StageTimer key={`${activeS}-${stage.timeLimitSec ?? 0}`} timeLimitSec={stage.timeLimitSec} /> : null}

      {/* Schüsse */}
      <Card className="animate-rise [animation-delay:120ms] p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-ink-3">{participant.name} · Schuss {Math.min(current.length + 1, stage.shots)} von {stage.shots}</span>
          <span className="text-sm font-semibold tabular-nums">{formatScore(stageTotal(current), decimal)}{hits ? ` / ${stage.shots}` : ` / ${stage.shots * stage.maxPerShot}`}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 min-h-10">
          {Array.from({ length: stage.shots }, (_, i) => {
            const v = current[i];
            const isNext = i === current.length;
            return (
              <span key={i} className={cn("flex h-10 min-w-10 px-2 items-center justify-center rounded-xl text-sm font-semibold tabular-nums border",
                v !== undefined ? (hits ? (v ? "animate-pop bg-ok/15 text-ok border-transparent" : "animate-pop bg-accent-soft text-accent border-transparent") : v >= stage.maxPerShot ? "animate-pop bg-ink text-bg border-ink" : v >= stage.maxPerShot - 1 ? "animate-pop bg-ink/10 border-transparent" : "animate-pop bg-surface-2 border-transparent")
                  : isNext && !finished ? "border-dashed border-ink/40 text-ink-3" : "border-dashed border-line text-transparent")}>
                {v !== undefined ? (hits ? (v ? "✓" : "✗") : formatScore(v, decimal)) : isNext && decimal && decimalBuffer ? decimalBuffer : "·"}
              </span>
            );
          })}
        </div>
        <div className="mt-2 min-h-4 text-[11px] text-ink-3 text-right" aria-live="polite">
          {failed[activeCell] ? (
            <span className="inline-flex items-center gap-1 text-accent"><AlertTriangle className="h-3 w-3" /> Nicht gespeichert: {failed[activeCell]}</span>
          ) : dirty[activeCell] !== undefined ? (
            online ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Speichern…</span>
              : <span className="inline-flex items-center gap-1 text-warn"><CloudOff className="h-3 w-3" /> Auf dem Gerät gespeichert – wird übertragen, sobald Empfang da ist</span>
          ) : saved[activeP] ? (
            <span className="inline-flex items-center gap-1 text-ok"><Check className="h-3 w-3" /> Gespeichert</span>
          ) : null}
        </div>
      </Card>

      {/* Eingabe */}
      {!finished ? (
        <div className="animate-rise [animation-delay:180ms]">
          {hits ? (
            <div className="grid grid-cols-2 gap-2">
              <Key onClick={() => addShot(1)} className="h-20 bg-ok/15 text-ok text-xl">Treffer</Key>
              <Key onClick={() => addShot(0)} className="h-20 bg-accent-soft text-accent text-xl">Fehler</Key>
              <Key onClick={undo} className="col-span-2 bg-surface" variant="secondary"><Delete className="h-5 w-5" /> Rückgängig</Key>
            </div>
          ) : decimal ? (
            <div className="grid grid-cols-3 gap-2">
              {["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0"].map((k) => (
                <Key key={k} onClick={() => pushDecimal(k)}>{k}</Key>
              ))}
              <Key onClick={undo} variant="secondary" label="Rückgängig"><Delete className="h-5 w-5" /></Key>
              <Key onClick={() => { setDecimalBuffer(""); addShot(stage.maxPerShot + 0.9); }} className="col-span-2 bg-ink text-bg">{stage.maxPerShot}.9 (Mouche)</Key>
              <Key onClick={commitDecimalBuffer} variant="secondary" disabled={!decimalBuffer}>OK</Key>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {keypadValues.map((v) => (
                <Key key={v} onClick={() => addShot(v)} className={cn(v === stage.maxPerShot && "bg-ink text-bg col-span-2", v === 0 && "text-ink-3")}>{v}</Key>
              ))}
              {stage.maxPerShot > 12 ? <ManualInput max={stage.maxPerShot} onAdd={addShot} /> : null}
              <Key onClick={undo} variant="secondary" label="Rückgängig" className={cn(keypadValues.length % 4 === 1 ? "col-span-2" : "")}><Delete className="h-5 w-5" /></Key>
            </div>
          )}
        </div>
      ) : null}

      {notice ? <Alert tone="info">{notice}</Alert> : null}

      {/* Aktionen */}
      <div className="animate-rise [animation-delay:240ms] flex flex-col gap-2 pt-2">
        {match.canEdit ? (
          <Button type="button" variant={finished ? "secondary" : "primary"} size="lg" disabled={pending} onClick={toggleStatus}>
            {finished ? <><Unlock className="h-4 w-4" /> Wieder öffnen</> : <><Lock className="h-4 w-4" /> Durchgang abschliessen</>}
          </Button>
        ) : null}
        {match.canDelete ? (
          <Button type="button" variant="ghost" size="sm" disabled={pending} className="text-ink-3" onClick={() => void remove()}>
            <Trash2 className="h-4 w-4" /> Löschen
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Key({ children, onClick, className, variant = "primary", disabled, label }: { children: React.ReactNode; onClick: () => void; className?: string; variant?: "primary" | "secondary"; disabled?: boolean; label?: string }) {
  const customBg = /\bbg-/.test(className ?? "");
  return (
    <button type="button" aria-label={label} onClick={() => { tap(); onClick(); }} disabled={disabled}
      className={cn("press h-14 rounded-2xl text-2xl font-semibold tabular-nums flex items-center justify-center gap-2 select-none touch-manipulation disabled:opacity-40 border border-transparent",
        variant === "primary" ? (customBg ? "" : "bg-surface border-line hover:bg-surface-2") : "bg-surface-2 text-ink-2 text-base", className)}>
      {children}
    </button>
  );
}

function ManualInput({ max, onAdd }: { max: number; onAdd: (v: number) => void }) {
  const [v, setV] = useState("");
  return (
    <form className="col-span-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(v); if (Number.isFinite(n) && n >= 0 && n <= max) { tap(); onAdd(n); setV(""); } }}>
      <input value={v} onChange={(e) => setV(e.target.value)} type="number" inputMode="numeric" min={0} max={max} placeholder={`0–${max}`} aria-label="Wert eingeben" className="flex-1 h-14 rounded-2xl border border-line bg-surface px-4 text-2xl tabular-nums focus:outline-none focus:border-ink" />
      <button type="submit" className="press h-14 px-5 rounded-2xl bg-ink text-bg font-semibold">OK</button>
    </form>
  );
}
