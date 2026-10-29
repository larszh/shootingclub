import "server-only";
import { db } from "@/lib/db";

/**
 * Hintergrundjobs im langlebigen Node-Prozess (PM2). Gestartet aus src/instrumentation.ts.
 *
 * - Pro Job eine Zeile in JobLock: eine zweite Instanz (oder ein Neustart während eines Laufs)
 *   führt denselben Job nie gleichzeitig aus.
 * - Intervall gilt über Instanzen und Neustarts hinweg (lastRunAt in der DB).
 * - JOBS_DISABLED=1 schaltet den Runner ab.
 */

export type JobFn = () => Promise<void>;
type JobDef = { name: string; everyMs: number; fn: JobFn };

type RunnerState = {
  jobs: Map<string, JobDef>;
  running: Set<string>;
  nextCheck: Map<string, number>;
  timer: ReturnType<typeof setInterval> | null;
  started: boolean;
};

const g = globalThis as { __standchefJobs?: RunnerState };
const state: RunnerState = (g.__standchefJobs ??= { jobs: new Map(), running: new Set(), nextCheck: new Map(), timer: null, started: false });

const TICK_MS = 10_000;
/** Mindestdauer der Sperre; ein Lauf, der länger dauert, sollte in Teilen arbeiten. */
const MIN_LOCK_MS = 5 * 60_000;
const MAX_LOCK_MS = 60 * 60_000;

/** Registriert (oder ersetzt) einen Job. everyMs = Mindestabstand zwischen zwei Läufen. */
export function registerJob(name: string, everyMs: number, fn: JobFn) {
  state.jobs.set(name, { name, everyMs: Math.max(5_000, everyMs), fn });
}

export function registeredJobs(): Array<{ name: string; everyMs: number }> {
  return [...state.jobs.values()].map((j) => ({ name: j.name, everyMs: j.everyMs }));
}

function lockTtl(everyMs: number) {
  return Math.min(MAX_LOCK_MS, Math.max(MIN_LOCK_MS, everyMs));
}

/** Versucht die Sperre zu bekommen. force=true ignoriert das Intervall (manueller Start). */
async function acquire(job: JobDef, force: boolean): Promise<boolean> {
  const now = new Date();
  await db.jobLock.upsert({ where: { name: job.name }, create: { name: job.name }, update: {} });
  const notLocked = { OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] };
  const due = { OR: [{ lastRunAt: null }, { lastRunAt: { lte: new Date(now.getTime() - job.everyMs + TICK_MS / 2) } }] };
  const res = await db.jobLock.updateMany({
    where: { name: job.name, AND: force ? [notLocked] : [notLocked, due] },
    data: { lockedUntil: new Date(now.getTime() + lockTtl(job.everyMs)) },
  });
  return res.count === 1;
}

function safeError(err: unknown) {
  return (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).replace(/[\r\n]+/g, " ").slice(0, 1000);
}

async function runOne(job: JobDef, force = false): Promise<"ran" | "skipped"> {
  if (state.running.has(job.name)) return "skipped";
  state.running.add(job.name);
  try {
    if (!(await acquire(job, force))) return "skipped";
    const startedAt = new Date();
    try {
      await job.fn();
      await db.jobLock.update({ where: { name: job.name }, data: { lockedUntil: null, lastRunAt: startedAt, lastStatus: "OK", lastError: null } });
    } catch (err) {
      const msg = safeError(err);
      console.error(`[jobs] ${job.name} fehlgeschlagen: ${msg}`);
      await db.jobLock
        .update({ where: { name: job.name }, data: { lockedUntil: null, lastRunAt: startedAt, lastStatus: "ERROR", lastError: msg } })
        .catch(() => undefined);
    }
    return "ran";
  } catch (err) {
    // DB nicht erreichbar o.ä.: nächster Tick versucht es erneut.
    console.warn(`[jobs] ${job.name}: Sperre nicht möglich (${safeError(err)})`);
    return "skipped";
  } finally {
    state.running.delete(job.name);
    state.nextCheck.set(job.name, Date.now() + Math.min(job.everyMs, 60_000));
  }
}

async function tick() {
  const now = Date.now();
  for (const job of state.jobs.values()) {
    if ((state.nextCheck.get(job.name) ?? 0) > now) continue;
    // Nicht awaiten: ein langer Job blockiert die anderen nicht.
    void runOne(job);
  }
}

/** Startet einen Job sofort (Super-Admin «Jetzt ausführen»). Respektiert die Sperre. */
export async function runJobNow(name: string): Promise<"ran" | "skipped" | "unknown"> {
  await ensureRegistered();
  const job = state.jobs.get(name);
  if (!job) return "unknown";
  return runOne(job, true);
}

let registering: Promise<void> | null = null;
async function ensureRegistered() {
  registering ??= import("./registry").then((m) => m.registerDefaultJobs());
  await registering;
}

/** Wird einmal pro Prozess aus instrumentation.ts aufgerufen. */
export async function startJobRunner() {
  if (state.started) return;
  if (process.env.JOBS_DISABLED === "1" || process.env.JOBS_DISABLED === "true") {
    console.info("[jobs] deaktiviert (JOBS_DISABLED)");
    return;
  }
  state.started = true;
  await ensureRegistered();
  // Erster Lauf kurz nach dem Start, damit der Server zuerst Anfragen bedienen kann.
  for (const job of state.jobs.values()) state.nextCheck.set(job.name, Date.now() + 15_000);
  state.timer = setInterval(() => void tick(), TICK_MS);
  state.timer.unref?.();
  console.info(`[jobs] gestartet: ${[...state.jobs.keys()].join(", ")}`);
}
