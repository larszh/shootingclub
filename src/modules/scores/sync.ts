import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { MODULES } from "@/lib/modules";
import { can, type Permission } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth";
import type { ScoreMatch, SyncMapping, SyncOpResult } from "@/lib/offline/types";
import { parseStages, sanitizeShots, stageTotal, type ScoringMode } from "./types";
import type { MatchView } from "./queries";

/**
 * Server-Logik für Durchgänge, gemeinsam genutzt von den Server Actions und der
 * Offline-Synchronisierung (/api/sync). Alle Funktionen prüfen Tenant und Rechte.
 */

export type ScoreActor = { userId: string; tenantId: string; can: (perm: Permission) => boolean };

type CoreFail = { ok: false; error: string; code: string; retry: boolean };
const coreFail = (error: string, code: string, retry = false): CoreFail => ({ ok: false, error, code, retry });

// ---------------------------------------------------------------------------
// Validierung
// ---------------------------------------------------------------------------

const idString = z.string().trim().min(1).max(64);
const clientIdSchema = z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/, "Ungültige Client-ID");

export const matchParticipantInputSchema = z.object({
  userId: idString.optional(),
  guestName: z.string().trim().max(60).optional(),
  note: z.string().trim().max(120).optional(),
});

export const createMatchInputSchema = z.object({
  clientId: clientIdSchema.optional(),
  programId: z.string().trim().min(1, "Programm wählen").max(64),
  title: z.string().trim().max(80).optional(),
  date: z.string().trim().max(40).optional(),
  locationNote: z.string().trim().max(120).optional(),
  participants: z.array(matchParticipantInputSchema).min(1, "Mindestens ein Teilnehmer").max(20),
});
export type CreateMatchInput = z.infer<typeof createMatchInputSchema>;

const matchRefSchema = z
  .object({ matchId: idString.optional(), matchClientId: clientIdSchema.optional() })
  .refine((r) => !!r.matchId || !!r.matchClientId, "Durchgang fehlt");

const timestampSchema = z.union([z.number(), z.string(), z.date()]).optional();

export const saveStageResultInputSchema = z.intersection(
  matchRefSchema,
  z.object({
    participantKey: z.union([z.string().trim().min(1).max(64), z.number().int().min(0).max(100)]).transform(String),
    stageIndex: z.number().int().min(0).max(100),
    shots: z.array(z.number()).max(200),
    clientUpdatedAt: timestampSchema,
  }),
);
export type SaveStageResultInput = z.input<typeof saveStageResultInputSchema>;

export const setMatchStatusInputSchema = z.intersection(
  matchRefSchema,
  z.object({ status: z.enum(["OPEN", "FINISHED"]), clientUpdatedAt: timestampSchema }),
);

/** Gerätezeit übernehmen, aber nie weiter als 5 Minuten in die Zukunft (falsch gestellte Uhren). */
function clampClientTime(v: number | string | Date | undefined): Date {
  const now = Date.now();
  if (v === undefined) return new Date(now);
  const t = v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v);
  if (!Number.isFinite(t) || t < Date.UTC(2020, 0, 1)) return new Date(now);
  return new Date(Math.min(t, now + 5 * 60_000));
}

function parseMatchDate(date: string | undefined): Date {
  if (!date) return new Date();
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

// ---------------------------------------------------------------------------
// Tenant-Kontext für die Synchronisierung (pro Operation, unabhängig vom aktiven Tenant)
// ---------------------------------------------------------------------------

/** Liefert den Akteur für einen Tenant, wenn der Benutzer Zugriff hat und das Modul aktiv ist. */
export async function scoreActorForTenant(user: CurrentUser, tenantId: string): Promise<ScoreActor | CoreFail> {
  const membership = user.memberships.find((m) => m.tenantId === tenantId);
  if (!membership) {
    if (!user.isSuperAdmin) return coreFail("Kein Zugriff auf diesen Verein", "forbidden");
    const exists = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!exists) return coreFail("Verein nicht gefunden", "not_found");
  }
  const setting = await db.tenantModule.findFirst({ where: { tenantId, moduleKey: "scores" } });
  const enabled = setting ? setting.enabled : (MODULES.find((m) => m.key === "scores")?.defaultEnabled ?? false);
  if (!enabled) return coreFail("Punkteerfassung ist in diesem Verein nicht aktiv", "module_disabled");
  const actor = { isSuperAdmin: user.isSuperAdmin, role: membership?.role ?? null };
  return { userId: user.id, tenantId, can: (perm) => can(actor, perm) };
}

// ---------------------------------------------------------------------------
// Durchgang erstellen (idempotent über clientId)
// ---------------------------------------------------------------------------

function mappingFor(clientId: string, matchId: string, count: number, participants: Array<{ id: string; sortOrder: number }>): SyncMapping {
  const participantIds = Array.from({ length: count }, (_, i) => participants.find((p) => p.sortOrder === i)?.id ?? null);
  return { matchClientId: clientId, matchId, participantIds };
}

export async function createMatchCore(
  actor: ScoreActor,
  input: CreateMatchInput,
): Promise<{ ok: true; matchId: string; created: boolean; mapping: SyncMapping | null } | CoreFail> {
  if (!actor.can("match.create")) return coreFail("Keine Berechtigung", "forbidden");
  const { clientId, programId, title, date, locationNote, participants } = input;

  const existingByClientId = async () => {
    if (!clientId) return null;
    const existing = await db.match.findUnique({ where: { clientId }, include: { participants: { select: { id: true, sortOrder: true } } } });
    if (!existing) return null;
    if (existing.tenantId !== actor.tenantId || existing.createdById !== actor.userId) return coreFail("Konflikt mit einem anderen Durchgang", "conflict");
    return { ok: true as const, matchId: existing.id, created: false, mapping: mappingFor(clientId, existing.id, participants.length, existing.participants) };
  };

  const already = await existingByClientId();
  if (already) return already;

  const program = await db.program.findUnique({ where: { id: programId } });
  if (!program || (program.tenantId && program.tenantId !== actor.tenantId) || program.isArchived) return coreFail("Programm nicht verfügbar", "program_unavailable");

  // Nur Mitglieder desselben Tenants als Gegner; Reihenfolge = Index aus dem Client.
  const memberIds = new Set((await db.membership.findMany({ where: { tenantId: actor.tenantId }, select: { userId: true } })).map((m) => m.userId));
  const seen = new Set<string>();
  const rows: Array<{ userId: string | null; guestName: string | null; note: string | null; sortOrder: number }> = [];
  participants.forEach((p, index) => {
    if (p.userId) {
      if (!memberIds.has(p.userId) || seen.has(p.userId)) return;
      seen.add(p.userId);
      rows.push({ userId: p.userId, guestName: null, note: p.note || null, sortOrder: index });
    } else {
      rows.push({ userId: null, guestName: p.guestName || "Gast", note: p.note || null, sortOrder: index });
    }
  });
  if (rows.length === 0) return coreFail("Mindestens ein Teilnehmer", "invalid");

  try {
    const match = await db.match.create({
      data: {
        tenantId: actor.tenantId,
        programId,
        createdById: actor.userId,
        clientId: clientId ?? null,
        title: title || null,
        date: parseMatchDate(date),
        locationNote: locationNote || null,
        participants: { create: rows },
      },
      include: { participants: { select: { id: true, sortOrder: true } } },
    });
    revalidatePath("/scores");
    return { ok: true, matchId: match.id, created: true, mapping: clientId ? mappingFor(clientId, match.id, participants.length, match.participants) : null };
  } catch (e) {
    // Gleichzeitige Übertragung derselben clientId: vorhandenen Durchgang zurückgeben
    if (isUniqueViolation(e)) {
      const again = await existingByClientId();
      if (again) return again;
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Bestehenden Durchgang laden und Rechte prüfen
// ---------------------------------------------------------------------------

async function loadMatchForActor(actor: ScoreActor, ref: { matchId?: string; matchClientId?: string }) {
  const include = { program: true, participants: true } as const;
  const m = ref.matchId
    ? await db.match.findUnique({ where: { id: ref.matchId }, include })
    : await db.match.findUnique({ where: { clientId: ref.matchClientId! }, include });
  if (!m) {
    // Offline erstellter Durchgang ist (noch) nicht übertragen: später erneut versuchen
    return ref.matchId ? coreFail("Durchgang nicht gefunden", "not_found") : coreFail("Durchgang wird noch übertragen", "pending_dependency", true);
  }
  if (m.tenantId !== actor.tenantId) return coreFail("Durchgang nicht gefunden", "not_found");
  const isCreator = m.createdById === actor.userId;
  const isParticipant = m.participants.some((p) => p.userId === actor.userId);
  if (!isCreator && !isParticipant && !actor.can("match.viewAll")) return coreFail("Keine Berechtigung", "forbidden");
  return { ok: true as const, match: m, isCreator };
}

// ---------------------------------------------------------------------------
// Serie speichern (last-write-wins über clientUpdatedAt)
// ---------------------------------------------------------------------------

export async function saveStageResultCore(
  actor: ScoreActor,
  raw: SaveStageResultInput,
): Promise<{ ok: true; total: number; ignored: boolean; matchId: string } | CoreFail> {
  const parsed = saveStageResultInputSchema.safeParse(raw);
  if (!parsed.success) return coreFail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe", "invalid");
  const input = parsed.data;
  const loaded = await loadMatchForActor(actor, input);
  if (!loaded.ok) return loaded;
  const { match } = loaded;
  if (match.status === "FINISHED") return coreFail("Durchgang ist abgeschlossen.", "finished");

  const byIndex = !!input.matchClientId && /^\d+$/.test(input.participantKey);
  const participant = byIndex
    ? match.participants.find((p) => p.sortOrder === Number(input.participantKey))
    : match.participants.find((p) => p.id === input.participantKey);
  if (!participant) return coreFail("Teilnehmer nicht gefunden", "not_found");

  const stages = parseStages(match.program.stagesJson);
  const stage = stages[input.stageIndex];
  if (!stage) return coreFail("Serie nicht gefunden", "not_found");
  const shots = sanitizeShots(input.shots, stage, match.program.scoringMode as ScoringMode);
  const total = stageTotal(shots);
  const clientUpdatedAt = clampClientTime(input.clientUpdatedAt);
  const shotsJson = JSON.stringify(shots);
  const where = { participantId_stageIndex: { participantId: participant.id, stageIndex: input.stageIndex } };

  const existing = await db.matchResult.findUnique({ where });
  let ignored = false;
  if (!existing) {
    try {
      await db.matchResult.create({ data: { participantId: participant.id, stageIndex: input.stageIndex, shotsJson, total, clientUpdatedAt } });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const res = await db.matchResult.updateMany({
        where: { participantId: participant.id, stageIndex: input.stageIndex, OR: [{ clientUpdatedAt: null }, { clientUpdatedAt: { lte: clientUpdatedAt } }] },
        data: { shotsJson, total, clientUpdatedAt },
      });
      ignored = res.count === 0;
    }
  } else {
    const res = await db.matchResult.updateMany({
      where: { id: existing.id, OR: [{ clientUpdatedAt: null }, { clientUpdatedAt: { lte: clientUpdatedAt } }] },
      data: { shotsJson, total, clientUpdatedAt },
    });
    ignored = res.count === 0;
  }

  if (ignored) {
    const current = await db.matchResult.findUnique({ where });
    return { ok: true, total: current?.total ?? total, ignored: true, matchId: match.id };
  }
  revalidatePath(`/scores/matches/${match.id}`);
  return { ok: true, total, ignored: false, matchId: match.id };
}

// ---------------------------------------------------------------------------
// Status setzen
// ---------------------------------------------------------------------------

export async function setMatchStatusCore(actor: ScoreActor, raw: z.input<typeof setMatchStatusInputSchema>): Promise<{ ok: true; matchId: string } | CoreFail> {
  const parsed = setMatchStatusInputSchema.safeParse(raw);
  if (!parsed.success) return coreFail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe", "invalid");
  const loaded = await loadMatchForActor(actor, parsed.data);
  if (!loaded.ok) return loaded;
  if (loaded.match.status !== parsed.data.status) {
    await db.match.update({ where: { id: loaded.match.id }, data: { status: parsed.data.status } });
  }
  revalidatePath(`/scores/matches/${loaded.match.id}`);
  revalidatePath("/scores");
  return { ok: true, matchId: loaded.match.id };
}

// ---------------------------------------------------------------------------
// Batch-Verarbeitung für /api/sync
// ---------------------------------------------------------------------------

export const wireOpSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: z.enum(["createMatch", "saveStageResult", "setMatchStatus"]),
  tenantId: idString,
  userId: idString,
  payload: z.unknown(),
});
export const syncRequestSchema = z.object({ ops: z.array(wireOpSchema).max(100) });
export type WireOpInput = z.infer<typeof wireOpSchema>;

export async function processSyncOps(user: CurrentUser, ops: WireOpInput[]): Promise<SyncOpResult[]> {
  const actors = new Map<string, ScoreActor | CoreFail>();
  const results: SyncOpResult[] = [];

  // Sequenziell in der übergebenen Reihenfolge: Erstellung vor Resultaten desselben Durchgangs.
  for (const op of ops) {
    try {
      if (op.userId !== user.id) {
        // Operation eines anderen Kontos auf diesem Gerät: liegen lassen, bis sich dieses wieder anmeldet
        results.push({ id: op.id, ok: false, error: "Gehört zu einem anderen Konto", code: "user_mismatch", retry: true });
        continue;
      }
      let actor = actors.get(op.tenantId);
      if (!actor) {
        actor = await scoreActorForTenant(user, op.tenantId);
        actors.set(op.tenantId, actor);
      }
      if ("ok" in actor) {
        results.push({ id: op.id, ok: false, error: actor.error, code: actor.code, retry: actor.retry });
        continue;
      }

      if (op.type === "createMatch") {
        const parsed = createMatchInputSchema.safeParse(op.payload);
        if (!parsed.success || !parsed.data.clientId) {
          results.push({ id: op.id, ok: false, error: parsed.success ? "Client-ID fehlt" : (parsed.error.issues[0]?.message ?? "Ungültige Eingabe"), code: "invalid", retry: false });
          continue;
        }
        const res = await createMatchCore(actor, parsed.data);
        results.push(res.ok ? { id: op.id, ok: true, matchId: res.matchId, mapping: res.mapping ?? undefined } : { id: op.id, ok: false, error: res.error, code: res.code, retry: res.retry });
      } else if (op.type === "saveStageResult") {
        const res = await saveStageResultCore(actor, op.payload as SaveStageResultInput);
        results.push(res.ok ? { id: op.id, ok: true, matchId: res.matchId, ignored: res.ignored } : { id: op.id, ok: false, error: res.error, code: res.code, retry: res.retry });
      } else {
        const res = await setMatchStatusCore(actor, op.payload as z.input<typeof setMatchStatusInputSchema>);
        results.push(res.ok ? { id: op.id, ok: true, matchId: res.matchId } : { id: op.id, ok: false, error: res.error, code: res.code, retry: res.retry });
      }
    } catch (e) {
      console.error("[sync] Operation fehlgeschlagen", op.type, e);
      results.push({ id: op.id, ok: false, error: "Serverfehler, wird erneut versucht", code: "server_error", retry: true });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Serialisierung für Client / IndexedDB
// ---------------------------------------------------------------------------

export function toScoreMatch(view: MatchView): ScoreMatch {
  return {
    id: view.id,
    clientId: view.clientId ?? null,
    title: view.title,
    date: view.date.toISOString(),
    generatedAt: new Date().toISOString(),
    status: view.status,
    locationNote: view.locationNote,
    createdByName: view.createdBy?.name ?? null,
    canEdit: view.canEdit,
    canDelete: view.canDelete,
    program: view.program,
    participants: view.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.name,
      isGuest: p.isGuest,
      note: p.note,
      isMe: p.isMe,
      avatarUrl: p.avatarUrl ?? null,
      results: p.results,
    })),
  };
}
