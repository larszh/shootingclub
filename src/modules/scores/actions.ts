"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModule, requirePermission, requireSuperAdmin } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { parseStages, programInputSchema, sanitizeShots, stageTotal, type ProgramInput, type ScoringMode } from "./types";

function parseProgramForm(formData: FormData) {
  const raw = {
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    discipline: formData.get("discipline"),
    weaponNote: formData.get("weaponNote") || undefined,
    scoringMode: formData.get("scoringMode"),
    stages: JSON.parse(String(formData.get("stagesJson") ?? "[]")),
  };
  return programInputSchema.safeParse(raw);
}

function programData(input: ProgramInput) {
  return {
    name: input.name,
    description: input.description ?? null,
    discipline: input.discipline,
    weaponNote: input.weaponNote ?? null,
    scoringMode: input.scoringMode,
    stagesJson: JSON.stringify(input.stages),
  };
}

/** Programm im Tenant anlegen (Admin) oder global (Super-Admin, scope=global). */
export async function saveProgramAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const scope = String(formData.get("scope") ?? "tenant");
  const id = formData.get("id") ? String(formData.get("id")) : null;
  const parsed = parseProgramForm(formData);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first ? `${first.path.join(".")}: ${first.message}` : "Ungültige Eingabe");
  }

  if (scope === "global") {
    const user = await requireSuperAdmin();
    if (id) {
      const existing = await db.program.findUnique({ where: { id } });
      if (!existing || existing.tenantId !== null) return fail("Nicht gefunden");
      await db.program.update({ where: { id }, data: programData(parsed.data) });
    } else {
      await db.program.create({ data: { ...programData(parsed.data), tenantId: null, createdById: user.id } });
    }
    revalidatePath("/super/programs");
    revalidatePath("/scores");
    redirect("/super/programs");
  }

  const ctx = await requirePermission("tenant.programs.manage");
  if (id) {
    const existing = await db.program.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
    await db.program.update({ where: { id }, data: programData(parsed.data) });
  } else {
    await db.program.create({ data: { ...programData(parsed.data), tenantId: ctx.tenant.id, createdById: ctx.user.id } });
  }
  revalidatePath("/scores");
  redirect("/scores/programs");
}

export async function setProgramHiddenAction(programId: string, hidden: boolean): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.programs.manage");
  const p = await db.program.findUnique({ where: { id: programId } });
  if (!p || (p.tenantId && p.tenantId !== ctx.tenant.id)) return fail("Nicht gefunden");
  await db.programTenantSetting.upsert({
    where: { programId_tenantId: { programId, tenantId: ctx.tenant.id } },
    create: { programId, tenantId: ctx.tenant.id, hidden },
    update: { hidden },
  });
  revalidatePath("/scores");
  return ok();
}

export async function archiveProgramAction(programId: string, archived: boolean): Promise<ActionResult> {
  const p = await db.program.findUnique({ where: { id: programId } });
  if (!p) return fail("Nicht gefunden");
  if (p.tenantId === null) {
    await requireSuperAdmin();
  } else {
    const ctx = await requirePermission("tenant.programs.manage");
    if (p.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  }
  await db.program.update({ where: { id: programId }, data: { isArchived: archived } });
  revalidatePath("/scores");
  revalidatePath("/super/programs");
  return ok();
}

export async function toggleFavoriteAction(programId: string): Promise<ActionResult<{ favorite: boolean }>> {
  const ctx = await requireModule("scores");
  const existing = await db.programFavorite.findUnique({ where: { userId_programId: { userId: ctx.user.id, programId } } });
  if (existing) {
    await db.programFavorite.delete({ where: { id: existing.id } });
  } else {
    await db.programFavorite.create({ data: { userId: ctx.user.id, programId } });
  }
  revalidatePath("/scores");
  return ok({ favorite: !existing });
}

const participantSchema = z.object({
  userId: z.string().optional(),
  guestName: z.string().trim().max(60).optional(),
  note: z.string().trim().max(120).optional(),
});

const createMatchSchema = z.object({
  programId: z.string().min(1, "Programm wählen"),
  title: z.string().trim().max(80).optional(),
  date: z.string().optional(),
  locationNote: z.string().trim().max(120).optional(),
  participants: z.array(participantSchema).min(1, "Mindestens ein Teilnehmer").max(20),
});

export async function createMatchAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireModule("scores");
  if (!ctx.can("match.create")) return fail("Keine Berechtigung");
  const parsed = createMatchSchema.safeParse({
    programId: formData.get("programId"),
    title: formData.get("title") || undefined,
    date: formData.get("date") || undefined,
    locationNote: formData.get("locationNote") || undefined,
    participants: JSON.parse(String(formData.get("participantsJson") ?? "[]")),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  const { programId, title, date, locationNote, participants } = parsed.data;

  const program = await db.program.findUnique({ where: { id: programId } });
  if (!program || (program.tenantId && program.tenantId !== ctx.tenant.id) || program.isArchived) return fail("Programm nicht verfügbar");

  // Nur Mitglieder desselben Tenants als Gegner
  const memberIds = new Set((await db.membership.findMany({ where: { tenantId: ctx.tenant.id }, select: { userId: true } })).map((m) => m.userId));
  const seen = new Set<string>();
  const rows: Array<{ userId: string | null; guestName: string | null; note: string | null; sortOrder: number }> = [];
  for (const p of participants) {
    if (p.userId) {
      if (!memberIds.has(p.userId) || seen.has(p.userId)) continue;
      seen.add(p.userId);
      rows.push({ userId: p.userId, guestName: null, note: p.note ?? null, sortOrder: rows.length });
    } else {
      rows.push({ userId: null, guestName: p.guestName || "Gast", note: p.note ?? null, sortOrder: rows.length });
    }
  }
  if (rows.length === 0) return fail("Mindestens ein Teilnehmer");

  const match = await db.match.create({
    data: {
      tenantId: ctx.tenant.id,
      programId,
      createdById: ctx.user.id,
      title: title ?? null,
      date: date ? new Date(date) : new Date(),
      locationNote: locationNote ?? null,
      participants: { create: rows },
    },
  });
  revalidatePath("/scores");
  redirect(`/scores/matches/${match.id}`);
}

async function loadEditableMatch(matchId: string) {
  const ctx = await requireModule("scores");
  const m = await db.match.findUnique({ where: { id: matchId }, include: { program: true, participants: true } });
  if (!m || m.tenantId !== ctx.tenant.id) return { ok: false as const, error: "Nicht gefunden" };
  const isCreator = m.createdById === ctx.user.id;
  const isParticipant = m.participants.some((p) => p.userId === ctx.user.id);
  if (!isCreator && !isParticipant && !ctx.can("match.viewAll")) return { ok: false as const, error: "Keine Berechtigung" };
  return { ok: true as const, ctx, match: m, isCreator };
}

export async function saveStageResultAction(input: { matchId: string; participantId: string; stageIndex: number; shots: number[] }): Promise<ActionResult<{ total: number }>> {
  const loaded = await loadEditableMatch(input.matchId);
  if (!loaded.ok) return fail(loaded.error);
  const { match } = loaded;
  if (match.status === "FINISHED") return fail("Wettkampf ist abgeschlossen.");
  const participant = match.participants.find((p) => p.id === input.participantId);
  if (!participant) return fail("Teilnehmer nicht gefunden");
  const stages = parseStages(match.program.stagesJson);
  const stage = stages[input.stageIndex];
  if (!stage) return fail("Serie nicht gefunden");
  const shots = sanitizeShots(input.shots, stage, match.program.scoringMode as ScoringMode);
  const total = stageTotal(shots);
  await db.matchResult.upsert({
    where: { participantId_stageIndex: { participantId: participant.id, stageIndex: input.stageIndex } },
    create: { participantId: participant.id, stageIndex: input.stageIndex, shotsJson: JSON.stringify(shots), total },
    update: { shotsJson: JSON.stringify(shots), total },
  });
  revalidatePath(`/scores/matches/${match.id}`);
  return ok({ total });
}

export async function setMatchStatusAction(matchId: string, status: "OPEN" | "FINISHED"): Promise<ActionResult> {
  const loaded = await loadEditableMatch(matchId);
  if (!loaded.ok) return fail(loaded.error);
  await db.match.update({ where: { id: matchId }, data: { status } });
  revalidatePath(`/scores/matches/${matchId}`);
  revalidatePath("/scores");
  return ok();
}

export async function deleteMatchAction(matchId: string): Promise<ActionResult> {
  const loaded = await loadEditableMatch(matchId);
  if (!loaded.ok) return fail(loaded.error);
  if (!loaded.isCreator && !loaded.ctx.can("match.delete")) return fail("Keine Berechtigung");
  await db.match.delete({ where: { id: matchId } });
  revalidatePath("/scores");
  redirect("/scores");
}
