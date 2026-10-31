"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireModule } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { clampAttempt, evaluatePass, passLabel } from "./official";
import { officialKindLabel } from "./types";
import { recomputeMatchTotals } from "./sync";
import { suggestAttempt } from "./official-service";

const idSchema = z.string().trim().min(1).max(64);

async function loadParticipant(participantId: string) {
  const ctx = await requireModule("scores");
  if (!ctx.can("results.verify")) return { ok: false as const, error: "Keine Berechtigung (Schützenmeister)" };
  const id = idSchema.safeParse(participantId);
  if (!id.success) return { ok: false as const, error: "Ungültige Eingabe" };
  const p = await db.matchParticipant.findFirst({
    where: { id: id.data, match: { tenantId: ctx.tenant.id } },
    include: {
      user: { select: { name: true } },
      match: { select: { id: true, date: true, createdAt: true, programId: true, program: { select: { name: true, officialKind: true, passMinScore: true, passMaxZeros: true } } } },
    },
  });
  if (!p) return { ok: false as const, error: "Teilnehmer nicht gefunden" };
  return { ok: true as const, ctx, p };
}

function revalidate(matchId: string) {
  revalidatePath(`/scores/matches/${matchId}`);
  revalidatePath("/federal");
}

/**
 * Resultat amtlich bestätigen (Schützenmeister). Setzt Versuch (automatisch oder eingegeben),
 * «bestanden» gemäss den Grenzwerten des Programms und den Bestätigenden. Ab dann ist das
 * Resultat für den Schützen schreibgeschützt.
 */
export async function confirmOfficialResultAction(participantId: string, attemptInput?: number | string | null): Promise<ActionResult<{ passed: boolean | null; attempt: number }>> {
  const loaded = await loadParticipant(participantId);
  if (!loaded.ok) return fail(loaded.error);
  const { ctx, p } = loaded;
  const program = p.match.program;
  if (!program.officialKind) return fail("Das Programm ist kein amtliches Programm (Obligatorisch, Feldschiessen, Qualifikation).");
  if (!p.userId) return fail("Gäste können nicht amtlich bestätigt werden. Bitte den Schützen als Mitglied erfassen.");

  // Gespeicherte Kennzahlen sicherheitshalber aus den Serien nachführen
  await recomputeMatchTotals(p.match.id, p.id);
  const fresh = await db.matchParticipant.findUnique({ where: { id: p.id }, select: { total: true, zeros: true } });
  if (!fresh || fresh.total === null) return fail("Noch kein Resultat erfasst.");

  let attempt: number;
  if (attemptInput !== undefined && attemptInput !== null && String(attemptInput).trim() !== "") {
    const a = clampAttempt(attemptInput);
    if (a === null) return fail("Versuch bitte als Zahl von 1 bis 20 angeben.");
    attempt = a;
  } else {
    attempt = await suggestAttempt(ctx.tenant.id, { id: p.id, userId: p.userId, match: p.match });
  }
  const passed = evaluatePass(fresh, program);
  const now = new Date();
  await db.matchParticipant.update({
    where: { id: p.id },
    data: { isOfficial: true, attempt, passed, verifiedById: ctx.user.id, verifiedAt: now },
  });
  await audit({
    tenantId: ctx.tenant.id,
    actorId: ctx.user.id,
    action: "results.official.confirm",
    entity: "MatchParticipant",
    entityId: p.id,
    detail: `${p.user?.name ?? "?"} · ${program.name} (${officialKindLabel(program.officialKind)}) · Total ${fresh.total} · Nuller ${fresh.zeros ?? 0} · Versuch ${attempt} · ${passLabel(passed)}`,
  });
  revalidate(p.match.id);
  return ok({ passed, attempt }, passed === false ? "Bestätigt – nicht bestanden" : passed ? "Bestätigt – bestanden" : "Amtlich bestätigt");
}

/** Versuchsnummer eines bestätigten Resultats ändern. */
export async function setOfficialAttemptAction(participantId: string, attemptInput: number | string): Promise<ActionResult> {
  const loaded = await loadParticipant(participantId);
  if (!loaded.ok) return fail(loaded.error);
  const { ctx, p } = loaded;
  if (!p.isOfficial) return fail("Resultat ist nicht amtlich bestätigt.");
  const a = clampAttempt(attemptInput);
  if (a === null) return fail("Versuch bitte als Zahl von 1 bis 20 angeben.");
  if (a === p.attempt) return ok();
  await db.matchParticipant.update({ where: { id: p.id }, data: { attempt: a } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "results.official.attempt", entity: "MatchParticipant", entityId: p.id, detail: `${p.user?.name ?? "?"} · ${p.match.program.name} · Versuch ${p.attempt ?? "–"} → ${a}` });
  revalidate(p.match.id);
  return ok(undefined, "Versuch gespeichert");
}

/** Bestätigung aufheben: Resultat ist wieder normal bearbeitbar. */
export async function revokeOfficialResultAction(participantId: string): Promise<ActionResult> {
  const loaded = await loadParticipant(participantId);
  if (!loaded.ok) return fail(loaded.error);
  const { ctx, p } = loaded;
  if (!p.isOfficial) return ok();
  await db.matchParticipant.update({ where: { id: p.id }, data: { isOfficial: false, attempt: null, passed: null, verifiedById: null, verifiedAt: null } });
  await audit({
    tenantId: ctx.tenant.id,
    actorId: ctx.user.id,
    action: "results.official.revoke",
    entity: "MatchParticipant",
    entityId: p.id,
    detail: `${p.user?.name ?? p.guestName ?? "?"} · ${p.match.program.name} · Versuch ${p.attempt ?? "–"} · war ${passLabel(p.passed)}`,
  });
  revalidate(p.match.id);
  return ok(undefined, "Bestätigung aufgehoben");
}
