"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModule, requirePermission, requireSuperAdmin } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { programInputSchema, type ProgramInput } from "./types";
import { createMatchCore, saveStageResultCore, setMatchStatusCore } from "./sync";

function emptyToNull(v: FormDataEntryValue | null) {
  if (v === null) return null;
  const s = String(v).trim().replace(",", ".");
  return s === "" ? null : s;
}

function parseProgramForm(formData: FormData) {
  const raw = {
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    discipline: formData.get("discipline"),
    weaponNote: formData.get("weaponNote") || undefined,
    scoringMode: formData.get("scoringMode"),
    stages: JSON.parse(String(formData.get("stagesJson") ?? "[]")),
    officialKind: formData.get("officialKind") || null,
    passMinScore: emptyToNull(formData.get("passMinScore")),
    passMaxZeros: emptyToNull(formData.get("passMaxZeros")),
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
    officialKind: input.officialKind ?? null,
    passMinScore: input.passMinScore ?? null,
    passMaxZeros: input.passMaxZeros ?? null,
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
  // Nur Programme, die im aktiven Verein sichtbar sind (global oder eigene).
  const program = await db.program.findUnique({ where: { id: String(programId) }, select: { tenantId: true } });
  if (!program || (program.tenantId && program.tenantId !== ctx.tenant.id)) return fail("Nicht gefunden");
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
  let participantsRaw: unknown = [];
  try {
    participantsRaw = JSON.parse(String(formData.get("participantsJson") ?? "[]"));
  } catch {
    return fail("Ungültige Teilnehmerliste");
  }
  const parsed = createMatchSchema.safeParse({
    programId: formData.get("programId"),
    title: formData.get("title") || undefined,
    date: formData.get("date") || undefined,
    locationNote: formData.get("locationNote") || undefined,
    participants: participantsRaw,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  // Optionale clientId (vom Gerät erzeugt) macht das Erstellen idempotent, z.B. bei Wiederholung nach Verbindungsabbruch.
  const clientIdRaw = formData.get("clientId");
  const clientId = typeof clientIdRaw === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(clientIdRaw) ? clientIdRaw : undefined;

  const res = await createMatchCore({ userId: ctx.user.id, tenantId: ctx.tenant.id, can: ctx.can }, { ...parsed.data, clientId });
  if (!res.ok) return fail(res.error);
  revalidatePath("/scores");
  redirect(`/scores/matches/${res.matchId}`);
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

/**
 * Serie speichern. `clientUpdatedAt` (ms, Gerätezeit) aktiviert last-write-wins: ältere
 * Änderungen als die gespeicherte werden ignoriert. Gemeinsame Logik mit der Offline-Synchronisierung.
 */
export async function saveStageResultAction(input: { matchId: string; participantId: string; stageIndex: number; shots: number[]; clientUpdatedAt?: number }): Promise<ActionResult<{ total: number }>> {
  const ctx = await requireModule("scores");
  const res = await saveStageResultCore(
    { userId: ctx.user.id, tenantId: ctx.tenant.id, can: ctx.can },
    { matchId: input.matchId, participantKey: input.participantId, stageIndex: input.stageIndex, shots: input.shots, clientUpdatedAt: input.clientUpdatedAt },
  );
  if (!res.ok) return fail(res.error);
  return ok({ total: res.total });
}

/** Status setzen, mit derselben last-write-wins-Logik wie die Offline-Synchronisierung (ohne Gerätezeit: jetzt). */
export async function setMatchStatusAction(matchId: string, status: "OPEN" | "FINISHED", clientUpdatedAt?: number): Promise<ActionResult> {
  const ctx = await requireModule("scores");
  const res = await setMatchStatusCore(
    { userId: ctx.user.id, tenantId: ctx.tenant.id, can: ctx.can },
    { matchId, status, clientUpdatedAt: clientUpdatedAt ?? Date.now() },
  );
  if (!res.ok) return fail(res.error);
  return ok();
}

export async function deleteMatchAction(matchId: string): Promise<ActionResult> {
  const loaded = await loadEditableMatch(matchId);
  if (!loaded.ok) return fail(loaded.error);
  if (!loaded.isCreator && !loaded.ctx.can("match.delete")) return fail("Keine Berechtigung");
  if (loaded.match.participants.some((p) => p.isOfficial)) {
    return fail("Der Durchgang enthält amtlich bestätigte Resultate. Bitte zuerst die Bestätigungen aufheben (Schützenmeister).");
  }
  await db.match.delete({ where: { id: matchId } });
  revalidatePath("/scores");
  redirect("/scores");
}

/**
 * Globales Programm als Vereinsprogramm kopieren (Admin). Die Kopie gehört dem aktiven Tenant
 * und kann frei angepasst werden; optional wird das globale Original im Verein versteckt.
 */
export async function copyProgramToTenantAction(programId: string, opts?: { hideOriginal?: boolean }): Promise<ActionResult<{ id: string }>> {
  const ctx = await requirePermission("tenant.programs.manage");
  if (!ctx.hasModule("scores")) return fail("Modul nicht aktiv");
  const idOk = z.string().min(1).max(64).safeParse(programId);
  if (!idOk.success) return fail("Ungültige Eingabe");
  const src = await db.program.findUnique({ where: { id: idOk.data } });
  if (!src || src.tenantId !== null) return fail("Nur globale Programme können kopiert werden");
  const copy = await db.program.create({
    data: {
      tenantId: ctx.tenant.id,
      createdById: ctx.user.id,
      name: src.name.slice(0, 80),
      description: src.description,
      discipline: src.discipline,
      weaponNote: src.weaponNote,
      scoringMode: src.scoringMode,
      stagesJson: src.stagesJson,
      officialKind: src.officialKind,
      passMinScore: src.passMinScore,
      passMaxZeros: src.passMaxZeros,
    },
  });
  if (opts?.hideOriginal) {
    await db.programTenantSetting.upsert({
      where: { programId_tenantId: { programId: src.id, tenantId: ctx.tenant.id } },
      create: { programId: src.id, tenantId: ctx.tenant.id, hidden: true },
      update: { hidden: true },
    });
  }
  revalidatePath("/scores");
  revalidatePath("/scores/programs");
  return ok({ id: copy.id }, "Als Vereinsprogramm kopiert");
}

/** Vereinsprogramm duplizieren (Admin), z.B. als Ausgangspunkt für eine Variante. */
export async function duplicateProgramAction(programId: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await requirePermission("tenant.programs.manage");
  if (!ctx.hasModule("scores")) return fail("Modul nicht aktiv");
  const idOk = z.string().min(1).max(64).safeParse(programId);
  if (!idOk.success) return fail("Ungültige Eingabe");
  const src = await db.program.findUnique({ where: { id: idOk.data } });
  if (!src || src.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  const suffix = " (Kopie)";
  const copy = await db.program.create({
    data: {
      tenantId: ctx.tenant.id,
      createdById: ctx.user.id,
      name: src.name.slice(0, 80 - suffix.length) + suffix,
      description: src.description,
      discipline: src.discipline,
      weaponNote: src.weaponNote,
      scoringMode: src.scoringMode,
      stagesJson: src.stagesJson,
      officialKind: src.officialKind,
      passMinScore: src.passMinScore,
      passMaxZeros: src.passMaxZeros,
    },
  });
  revalidatePath("/scores");
  revalidatePath("/scores/programs");
  return ok({ id: copy.id }, "Programm dupliziert");
}
