"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Delete, Lock, Trash2, Trophy, Unlock } from "lucide-react";
import { deleteMatchAction, saveStageResultAction, setMatchStatusAction } from "@/modules/scores/actions";
import type { MatchView } from "@/modules/scores/queries";
import { positionLabel, stageTotal } from "@/modules/scores/types";
import { Button, Card } from "@/components/ui";
import { cn, formatScore, initials } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ScoreEntry({ match }: { match: MatchView }) {
  const router = useRouter();
  const decimal = match.program.scoringMode === "RINGS_DECIMAL";
  const hits = match.program.scoringMode === "HITS";
  const stages = match.program.stages;
  const finished = match.status === "FINISHED";

  // Lokaler Zustand: shots[participantId][stageIndex]
  const [shots, setShots] = useState<Record<string, number[][]>>(() =>
    Object.fromEntries(match.participants.map((p) => [p.id, p.results.map((r) => r.shots)])),
  );
  const [activeP, setActiveP] = useState(match.participants.find((p) => p.isMe)?.id ?? match.participants[0]!.id);
  const [activeS, setActiveS] = useState(() => {
    const p = match.participants.find((x) => x.isMe) ?? match.participants[0]!;
    const idx = p.results.findIndex((r, i) => r.shots.length < stages[i]!.shots);
    return idx === -1 ? 0 : idx;
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [decimalBuffer, setDecimalBuffer] = useState("");
  const [pending, start] = useTransition();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const stage = stages[activeS]!;
  const current = shots[activeP]?.[activeS] ?? [];
  const participant = match.participants.find((p) => p.id === activeP)!;

  const persist = useCallback(
    (participantId: string, stageIndex: number, list: number[]) => {
      const key = `${participantId}:${stageIndex}`;
      clearTimeout(timers.current[key]);
      setSaveState("saving");
      timers.current[key] = setTimeout(async () => {
        const res = await saveStageResultAction({ matchId: match.id, participantId, stageIndex, shots: list });
        setSaveState(res.ok ? "saved" : "error");
        if (res.ok) router.refresh();
      }, 500);
    },
    [match.id, router],
  );

  const setCurrent = (list: number[]) => {
    setShots((s) => ({ ...s, [activeP]: s[activeP]!.map((arr, i) => (i === activeS ? list : arr)) }));
    persist(activeP, activeS, list);
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

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const keypadValues = useMemo(() => {
    const max = Math.min(stage.maxPerShot, 12);
    return Array.from({ length: max + 1 }, (_, i) => max - i);
  }, [stage.maxPerShot]);

  return (
    <div className="space-y-5">
      {/* Stand */}
      <Card className="animate-rise overflow-hidden">
        <div className="divide-y divide-line">
          {match.participants.map((p) => {
            const t = totals[p.id]!;
            const isLeader = finished && leader?.id === p.id && match.participants.length > 1;
            return (
              <button key={p.id} type="button" onClick={() => setActiveP(p.id)}
                className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors", activeP === p.id ? "bg-surface-2" : "hover:bg-surface-2/60")}>
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold", p.isGuest ? "bg-warn/20 text-warn" : "bg-ink text-bg")}>{initials(p.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-medium truncate">{p.name}{isLeader ? <Trophy className="h-4 w-4 text-accent" /> : null}{p.isMe ? <span className="text-xs text-ink-3">(du)</span> : null}</span>
                  <span className="flex gap-1 mt-1 flex-wrap">
                    {t.stages.map((st, i) => (
                      <span key={i} className={cn("rounded-md px-1.5 py-0.5 text-[11px] tabular-nums", (shots[p.id]?.[i]?.length ?? 0) >= stages[i]!.shots ? "bg-ink/10 text-ink" : "bg-surface-2 text-ink-3")}>{formatScore(st, decimal)}</span>
                    ))}
                  </span>
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
          <button type="button" onClick={() => setActiveS((s) => Math.max(0, s - 1))} disabled={activeS === 0} className="press h-9 w-9 rounded-full hover:bg-surface-2 disabled:opacity-30 flex items-center justify-center"><ChevronLeft className="h-5 w-5" /></button>
          <div className="text-center">
            <div className="font-semibold">{stage.name}</div>
            <div className="text-xs text-ink-3">{stage.distanceM} m · {stage.shots} Schuss{stage.position ? ` · ${positionLabel(stage.position)}` : ""}{stage.timeLimitSec ? ` · ${stage.timeLimitSec} s` : ""}</div>
          </div>
          <button type="button" onClick={() => setActiveS((s) => Math.min(stages.length - 1, s + 1))} disabled={activeS === stages.length - 1} className="press h-9 w-9 rounded-full hover:bg-surface-2 disabled:opacity-30 flex items-center justify-center"><ChevronRight className="h-5 w-5" /></button>
        </div>
        <div className="flex gap-1 justify-center">
          {stages.map((st, i) => {
            const done = (shots[activeP]?.[i]?.length ?? 0) >= st.shots;
            return <button key={i} type="button" onClick={() => setActiveS(i)} aria-label={st.name} className={cn("h-1.5 rounded-full transition-all", i === activeS ? "w-6 bg-ink" : done ? "w-3 bg-ink/40" : "w-3 bg-line")} />;
          })}
        </div>
      </div>

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
        <div className="mt-2 h-4 text-[11px] text-ink-3 text-right">
          {saveState === "saving" ? "Speichern…" : saveState === "saved" ? <span className="inline-flex items-center gap-1 text-ok"><Check className="h-3 w-3" /> Gespeichert</span> : saveState === "error" ? <span className="text-accent">Speichern fehlgeschlagen</span> : null}
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
              <Key onClick={undo} variant="secondary"><Delete className="h-5 w-5" /></Key>
              <Key onClick={() => { setDecimalBuffer(""); addShot(stage.maxPerShot + 0.9); }} className="col-span-2 bg-ink text-bg">{stage.maxPerShot}.9 (Mouche)</Key>
              <Key onClick={commitDecimalBuffer} variant="secondary" disabled={!decimalBuffer}>OK</Key>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {keypadValues.map((v) => (
                <Key key={v} onClick={() => addShot(v)} className={cn(v === stage.maxPerShot && "bg-ink text-bg col-span-2", v === 0 && "text-ink-3")}>{v}</Key>
              ))}
              {stage.maxPerShot > 12 ? <ManualInput max={stage.maxPerShot} onAdd={addShot} /> : null}
              <Key onClick={undo} variant="secondary" className={cn(keypadValues.length % 4 === 1 ? "col-span-2" : "")}><Delete className="h-5 w-5" /></Key>
            </div>
          )}
        </div>
      ) : null}

      {/* Aktionen */}
      <div className="animate-rise [animation-delay:240ms] flex flex-col gap-2 pt-2">
        {match.canEdit ? (
          <Button type="button" variant={finished ? "secondary" : "primary"} size="lg" disabled={pending}
            onClick={() => start(async () => { await setMatchStatusAction(match.id, finished ? "OPEN" : "FINISHED"); router.refresh(); })}>
            {finished ? <><Unlock className="h-4 w-4" /> Wieder öffnen</> : <><Lock className="h-4 w-4" /> Durchgang abschliessen</>}
          </Button>
        ) : null}
        {match.canDelete ? (
          <Button type="button" variant="ghost" size="sm" disabled={pending} className="text-ink-3"
            onClick={() => { if (confirm("Durchgang wirklich löschen?")) start(() => deleteMatchAction(match.id).then(() => undefined)); }}>
            <Trash2 className="h-4 w-4" /> Löschen
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Key({ children, onClick, className, variant = "primary", disabled }: { children: React.ReactNode; onClick: () => void; className?: string; variant?: "primary" | "secondary"; disabled?: boolean }) {
  const customBg = /\bbg-/.test(className ?? "");
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn("press h-14 rounded-2xl text-2xl font-semibold tabular-nums flex items-center justify-center gap-2 select-none disabled:opacity-40 border border-transparent",
        variant === "primary" ? (customBg ? "" : "bg-surface border-line hover:bg-surface-2") : "bg-surface-2 text-ink-2 text-base", className)}>
      {children}
    </button>
  );
}

function ManualInput({ max, onAdd }: { max: number; onAdd: (v: number) => void }) {
  const [v, setV] = useState("");
  return (
    <form className="col-span-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(v); if (Number.isFinite(n) && n >= 0 && n <= max) { onAdd(n); setV(""); } }}>
      <input value={v} onChange={(e) => setV(e.target.value)} type="number" inputMode="numeric" min={0} max={max} placeholder={`0–${max}`} className="flex-1 h-14 rounded-2xl border border-line bg-surface px-4 text-2xl tabular-nums focus:outline-none focus:border-ink" />
      <button type="submit" className="press h-14 px-5 rounded-2xl bg-ink text-bg font-semibold">OK</button>
    </form>
  );
}
