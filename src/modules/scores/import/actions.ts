"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { throttle } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { requireModule } from "@/lib/tenant";
import { zurichToUtc } from "@/lib/time";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { parseStages } from "../types";
import { recomputeMatchTotals } from "../sync";
import { SCORE_IMPORT_MAX_BYTES, SCORE_IMPORT_MAX_COLUMNS, SCORE_PRESETS, SCORE_PRESET_IDS, normalizeMapping, readScoreFile, type ScorePresetId } from "./parse";
import { parseAssignment, SINGLE_SHOOTER_NAME } from "./shooters";
import { planImport } from "./plan";
import { findPreviousImport, isStaleImport, type PreviousImport } from "./queries";

/**
 * Resultat-Import übernehmen. Nur für Trainer und Vorstand (alle Resultate sehen bzw. Programme
 * verwalten) – «Durchgang erstellen» für eigene Resultate genügt nicht, weil Resultate anderer
 * Mitglieder geschrieben werden.
 */
async function importContext() {
  const ctx = await requireModule("scores");
  if (!ctx.can("match.viewAll") && !ctx.can("tenant.programs.manage")) return null;
  return ctx;
}

const hashSchema = z.string().regex(/^[0-9a-f]{64}$/);

/** Vorab-Prüfung (Hash im Browser berechnet): Wurde diese Datei schon importiert? */
export async function checkScoreImportAction(fileHash: string): Promise<ActionResult<{ previous: PreviousImport | null }>> {
  const ctx = await importContext();
  if (!ctx) return fail("Keine Berechtigung");
  const parsed = hashSchema.safeParse(fileHash);
  if (!parsed.success) return fail("Ungültige Eingabe");
  const previous = await findPreviousImport(ctx.tenant.id, parsed.data);
  return ok({ previous: previous && !isStaleImport(previous) ? previous : null });
}

const configSchema = z.object({
  preset: z.enum(SCORE_PRESET_IDS as [ScorePresetId, ...ScorePresetId[]]),
  layout: z.enum(["shots", "totals"]),
  mapping: z.array(z.string().max(30)).max(SCORE_IMPORT_MAX_COLUMNS),
  discipline: z.string().max(200).nullable(),
  programId: z.string().trim().min(1, "Programm wählen").max(64),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum wählen"),
  assignments: z.record(z.string().max(300), z.string().max(80)),
});

export type CommitScoreImportResult =
  | { status: "created"; matchId: string; participants: number; guests: number }
  | { status: "duplicate"; previous: PreviousImport };

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

/**
 * Übernahme: Datei wird erneut gelesen und vollständig geprüft (die Vorschau im Browser ist nur
 * eine Hilfe). Legt einen abgeschlossenen Durchgang mit allen Teilnehmern und Serien an.
 * Idempotent über ScoreImport (tenantId, fileHash).
 */
export async function commitScoreImportAction(formData: FormData): Promise<ActionResult<CommitScoreImportResult>> {
  const ctx = await importContext();
  if (!ctx) return fail("Keine Berechtigung");
  const limited = throttle(`score-import:${ctx.tenant.id}`, 30, 60 * 60_000);
  if (limited) return fail(limited);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Bitte eine Datei auswählen.");
  if (file.size > SCORE_IMPORT_MAX_BYTES) return fail("Die Datei ist grösser als 5 MB. Bitte in mehrere Dateien aufteilen.");
  let configRaw: unknown;
  try {
    configRaw = JSON.parse(String(formData.get("config") ?? ""));
  } catch {
    return fail("Ungültige Eingabe");
  }
  const parsed = configSchema.safeParse(configRaw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  const config = parsed.data;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  const previous = await findPreviousImport(ctx.tenant.id, fileHash);
  if (previous && !isStaleImport(previous)) return ok({ status: "duplicate", previous });
  // Früherer Import, dessen Durchgänge alle gelöscht wurden: Eintrag wird in der Transaktion ersetzt
  const staleImportId = previous ? previous.id : null;

  let table;
  try {
    table = readScoreFile(bytes);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die Datei konnte nicht gelesen werden.");
  }

  const program = await db.program.findUnique({ where: { id: config.programId } });
  if (!program || (program.tenantId && program.tenantId !== ctx.tenant.id) || program.isArchived) return fail("Programm nicht verfügbar");
  const stages = parseStages(program.stagesJson);
  if (!stages.length) return fail("Das Programm hat keine Serien.");

  // Nur aktuelle Mitglieder (nicht ausgetreten, Konto nicht gelöscht)
  const memberIds = new Set(
    (await db.membership.findMany({ where: { tenantId: ctx.tenant.id, status: { not: "LEFT" }, user: { deletedAt: null } }, select: { userId: true } })).map((m) => m.userId),
  );
  const plan = planImport(
    table,
    { layout: config.layout, mapping: normalizeMapping(config.mapping, table.headers.length), discipline: config.discipline },
    { stages, scoringMode: program.scoringMode },
    (s) => parseAssignment(config.assignments[s.key]) ?? { kind: "skip" },
    memberIds,
  );
  if (plan.globalErrors.length) return fail(plan.globalErrors[0]!);
  if (plan.included === 0) return fail("Keine Schützen zum Übernehmen.");
  if (plan.blocking > 0) return fail(`${plan.blocking} ${plan.blocking === 1 ? "Schütze hat" : "Schützen haben"} noch Fehler. Bitte korrigieren oder «Nicht übernehmen» wählen.`);

  const included = plan.participants.filter((p) => p.assignment.kind !== "skip");
  const fileName = (file.name || "Datei").replace(/[\r\n\t]/g, " ").slice(0, 120);
  const title = `Import ${fileName}`.slice(0, 80);
  const now = new Date();
  const format = SCORE_PRESETS[config.preset].format;
  const usedRows = included.reduce((a, p) => a + p.shooter.rowCount, 0);

  let matchId: string;
  try {
    matchId = await db.$transaction(
      async (tx) => {
        if (staleImportId) await tx.scoreImport.deleteMany({ where: { id: staleImportId, tenantId: ctx.tenant.id } });
        // Zuerst den Import registrieren: die Eindeutigkeit (tenantId, fileHash) verhindert Doppelimporte auch bei gleichzeitiger Übernahme
        const imp = await tx.scoreImport.create({
          data: { tenantId: ctx.tenant.id, createdById: ctx.user.id, format, fileName, fileHash, rows: usedRows },
        });
        const match = await tx.match.create({
          data: {
            tenantId: ctx.tenant.id,
            programId: program.id,
            createdById: ctx.user.id,
            title,
            date: zurichToUtc(config.date, "12:00"),
            status: "FINISHED",
            finishedAt: now,
            participants: {
              create: included.map((p, i) => ({
                userId: p.assignment.kind === "member" ? p.assignment.userId : null,
                guestName: p.assignment.kind === "member" ? null : (p.shooter.name === SINGLE_SHOOTER_NAME ? "Gast" : p.shooter.name).slice(0, 60),
                note: p.note,
                sortOrder: i,
                results: {
                  create: p.evaluation.stages.map((st) => ({
                    stageIndex: st.stageIndex,
                    // Nur Totale bekannt: leere Schussliste, Total der Serie bleibt gespeichert
                    shotsJson: JSON.stringify(st.shots ?? []),
                    total: st.total,
                  })),
                },
              })),
            },
          },
          select: { id: true },
        });
        await tx.scoreImport.update({ where: { id: imp.id }, data: { matchIds: match.id } });
        return match.id;
      },
      { timeout: 30_000 },
    );
  } catch (e) {
    if (isUniqueViolation(e)) {
      const again = await findPreviousImport(ctx.tenant.id, fileHash);
      if (again && !isStaleImport(again)) return ok({ status: "duplicate", previous: again });
    }
    throw e;
  }

  // Gespeicherte Kennzahlen (MatchParticipant.total/zeros) über den gemeinsamen Helfer berechnen
  await recomputeMatchTotals(matchId);

  const guests = included.filter((p) => p.assignment.kind === "guest").length;
  await audit({
    tenantId: ctx.tenant.id,
    actorId: ctx.user.id,
    action: "scores.import",
    entity: "Match",
    entityId: matchId,
    detail: `${SCORE_PRESETS[config.preset].label}: «${fileName}», ${included.length} Schützen (${guests} Gäste), Programm «${program.name}»`,
  });
  revalidatePath("/scores");
  revalidatePath("/scores/import");
  return ok({ status: "created", matchId, participants: included.length, guests }, "Resultate importiert");
}
