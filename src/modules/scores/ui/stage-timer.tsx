"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pause, Play, RotateCcw, Timer, Volume2, VolumeX } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Ton und Vibration (ausserhalb der Komponente, damit der Render rein bleibt)
// ---------------------------------------------------------------------------

let audioCtx: AudioContext | null = null;

/** AudioContext muss in einer Benutzeraktion erzeugt/fortgesetzt werden (iOS). */
function unlockAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx ??= new Ctor();
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

function beep(freq: number, seconds: number) {
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    gain.gain.setValueAtTime(0.25, t + Math.max(0.02, seconds - 0.04));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  } catch {
    // Audio nicht verfügbar
  }
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // nicht unterstützt
  }
}

function nowMs() {
  return performance.now();
}

function formatClock(ms: number, tenths: boolean) {
  const clamped = Math.max(0, ms);
  const totalSec = tenths ? Math.floor(clamped / 1000) : Math.ceil(clamped / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const base = `${m}:${String(s).padStart(2, "0")}`;
  return tenths ? `${base}.${Math.floor((clamped % 1000) / 100)}` : base;
}

/** Bildschirm wach halten, solange `active` (Wake Lock API, wenn verfügbar). */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const l = await navigator.wakeLock.request("screen");
        if (cancelled) void l.release();
        else lock = l;
      } catch {
        // abgelehnt (z.B. Energiesparmodus)
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

// ---------------------------------------------------------------------------

export function StageTimer({ timeLimitSec }: { timeLimitSec?: number }) {
  if (timeLimitSec && timeLimitSec > 0) return <Countdown limitMs={timeLimitSec * 1000} />;
  return <Stopwatch />;
}

type Phase = "idle" | "leadin" | "running" | "paused" | "done";

function Countdown({ limitMs }: { limitMs: number }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(limitMs);
  const [leadLeft, setLeadLeft] = useState(0);
  const [useLeadIn, setUseLeadIn] = useState(true);
  const [sound, setSound] = useState(true);
  const remainingRef = useRef(limitMs);
  const endAtRef = useRef(0);
  const leadEndRef = useRef(0);
  const lastLeadRef = useRef(0);
  const lastWarnRef = useRef<number | null>(null);
  const soundRef = useRef(true);

  const active = phase === "running" || phase === "leadin";
  useWakeLock(active);

  useEffect(() => {
    if (phase !== "running" && phase !== "leadin") return;
    const id = setInterval(() => {
      const now = nowMs();
      if (phase === "leadin") {
        const left = Math.ceil((leadEndRef.current - now) / 1000);
        if (left <= 0) {
          if (soundRef.current) beep(1320, 0.35);
          vibrate(60);
          endAtRef.current = now + remainingRef.current;
          setLeadLeft(0);
          setPhase("running");
        } else if (left !== lastLeadRef.current) {
          lastLeadRef.current = left;
          if (soundRef.current) beep(660, 0.12);
          setLeadLeft(left);
        }
        return;
      }
      const rem = endAtRef.current - now;
      if (rem <= 0) {
        remainingRef.current = 0;
        setRemaining(0);
        setPhase("done");
        if (soundRef.current) beep(880, 0.9);
        vibrate([250, 120, 250, 120, 400]);
        return;
      }
      // Kurzer Hinweiston bei 10 und 5 Sekunden
      const sec = Math.ceil(rem / 1000);
      if ((sec === 10 || sec === 5) && lastWarnRef.current !== sec && limitMs > sec * 2000) {
        lastWarnRef.current = sec;
        if (soundRef.current) beep(990, 0.08);
      }
      remainingRef.current = rem;
      setRemaining(rem);
    }, 100);
    return () => clearInterval(id);
  }, [phase, limitMs]);

  const start = () => {
    unlockAudio();
    if (phase === "done") {
      remainingRef.current = limitMs;
      setRemaining(limitMs);
    }
    lastWarnRef.current = null;
    const now = nowMs();
    if (useLeadIn && (phase === "idle" || phase === "done")) {
      leadEndRef.current = now + 3000;
      lastLeadRef.current = 3;
      if (soundRef.current) beep(660, 0.12);
      vibrate(15);
      setLeadLeft(3);
      setPhase("leadin");
    } else {
      endAtRef.current = now + remainingRef.current;
      if (soundRef.current) beep(1320, 0.35);
      vibrate(60);
      setPhase("running");
    }
  };

  const pause = () => {
    if (phase === "running") {
      remainingRef.current = Math.max(0, endAtRef.current - nowMs());
      setRemaining(remainingRef.current);
      setPhase("paused");
    } else if (phase === "leadin") {
      setLeadLeft(0);
      setPhase(remainingRef.current < limitMs ? "paused" : "idle");
    }
  };

  const reset = () => {
    remainingRef.current = limitMs;
    setRemaining(limitMs);
    setLeadLeft(0);
    setPhase("idle");
  };

  const toggleSound = () => {
    soundRef.current = !soundRef.current;
    setSound(soundRef.current);
  };

  const warn = phase === "running" && remaining <= 5000;
  const progress = Math.max(0, Math.min(1, remaining / limitMs));

  return (
    <Card className={cn("animate-rise overflow-hidden", phase === "done" && "border-accent")}>
      <div className="h-1.5 bg-surface-2">
        <div className={cn("h-full transition-[width] duration-100 ease-linear", warn || phase === "done" ? "bg-accent" : "bg-ink")} style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span className="inline-flex items-center gap-1.5 font-medium uppercase tracking-wider"><Timer className="h-3.5 w-3.5" /> Zeitlimit</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setUseLeadIn((v) => !v)} aria-pressed={useLeadIn} disabled={active}
              className={cn("press h-8 rounded-full px-3 text-xs font-medium disabled:opacity-50", useLeadIn ? "bg-ink text-bg" : "bg-surface-2 text-ink-2")}>
              3-2-1
            </button>
            <button type="button" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? "Ton ausschalten" : "Ton einschalten"}
              className="press flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-ink-2">
              {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="my-3 text-center" aria-live="polite">
          {phase === "leadin" ? (
            <div key={leadLeft} className="animate-pop text-7xl font-semibold tabular-nums text-accent">{leadLeft}</div>
          ) : phase === "done" ? (
            <div className="animate-pop text-6xl font-semibold text-accent">Zeit!</div>
          ) : (
            <div className={cn("text-7xl font-semibold tabular-nums leading-none", warn && "text-accent")}>{formatClock(remaining, remaining < 10_000)}</div>
          )}
          <div className="mt-2 text-xs text-ink-3">
            {phase === "idle" ? (limitMs < 60_000 ? `${Math.round(limitMs / 1000)} Sekunden für diese Serie` : `${formatClock(limitMs, false)} Minuten für diese Serie`) : phase === "paused" ? "Pausiert" : phase === "leadin" ? "Achtung …" : phase === "done" ? "Feuer einstellen" : "Läuft"}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {active ? (
            <button type="button" onClick={pause} className="press col-span-2 flex h-14 items-center justify-center gap-2 rounded-2xl bg-surface-2 text-lg font-semibold">
              <Pause className="h-5 w-5" /> Pause
            </button>
          ) : (
            <button type="button" onClick={start} className="press col-span-2 flex h-14 items-center justify-center gap-2 rounded-2xl bg-ink text-lg font-semibold text-bg">
              <Play className="h-5 w-5" /> {phase === "paused" ? "Weiter" : phase === "done" ? "Nochmals" : "Start"}
            </button>
          )}
          <button type="button" onClick={reset} disabled={phase === "idle"} className="press flex h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-surface font-medium text-ink-2 disabled:opacity-40">
            <RotateCcw className="h-5 w-5" /> <span className="sr-only sm:not-sr-only">Zurück</span>
          </button>
        </div>
      </div>
    </Card>
  );
}

function Stopwatch() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const accRef = useRef(0);

  useWakeLock(running);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(accRef.current + nowMs() - startRef.current), 100);
    return () => clearInterval(id);
  }, [running]);

  const toggle = () => {
    vibrate(10);
    if (running) {
      accRef.current += nowMs() - startRef.current;
      setElapsed(accRef.current);
      setRunning(false);
    } else {
      startRef.current = nowMs();
      setRunning(true);
    }
  };
  const reset = () => {
    accRef.current = 0;
    startRef.current = nowMs();
    setElapsed(0);
  };

  return (
    <Card className="animate-rise overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 h-12 text-left text-sm font-medium text-ink-2">
        <Timer className="h-4 w-4" /> Stoppuhr
        {!open && (running || elapsed > 0) ? <span className="tabular-nums text-ink">{formatClock(elapsed, true)}</span> : null}
        <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="animate-fade px-4 pb-4">
          <div className="text-center text-6xl font-semibold tabular-nums leading-none py-2">{formatClock(elapsed, true)}</div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button type="button" onClick={toggle} className={cn("press col-span-2 flex h-14 items-center justify-center gap-2 rounded-2xl text-lg font-semibold", running ? "bg-surface-2" : "bg-ink text-bg")}>
              {running ? <><Pause className="h-5 w-5" /> Stopp</> : <><Play className="h-5 w-5" /> {elapsed > 0 ? "Weiter" : "Start"}</>}
            </button>
            <button type="button" onClick={reset} disabled={elapsed === 0 && !running} className="press flex h-14 items-center justify-center rounded-2xl border border-line bg-surface text-ink-2 disabled:opacity-40" aria-label="Zurücksetzen">
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
