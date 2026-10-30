"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireModule } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { canEditYear, listOfficialPrograms } from "./queries";
import { dayToDbDate } from "./types";

const dayField = z
  .string()
  .trim()
  .max(10)
  .optional()
  .transform((v, c) => {
    if (!v) return null;
    const d = dayToDbDate(v);
    if (!d) {
      c.addIssue({ code: "custom", message: "Ungültiges Datum" });
      return z.NEVER;
    }
    return d;
  });

const yearSchema = z.object({
  year: z.coerce.number().int().min(2000, "Ungültiges Jahr").max(2100, "Ungültiges Jahr"),
  registrationDeadline: dayField,
  shootingDeadline: dayField,
  reportDeadline: dayField,
  notes: z.string().trim().max(5000, "Notizen höchstens 5000 Zeichen").optional(),
});

/** Fristen und Notizen eines Jahres speichern (Schützenmeister oder Admin). */
export async function saveFederalYearAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireModule("federal");
  if (!canEditYear(ctx)) return fail("Keine Berechtigung");
  const parsed = yearSchema.safeParse({
    year: formData.get("year"),
    registrationDeadline: formData.get("registrationDeadline") ?? undefined,
    shootingDeadline: formData.get("shootingDeadline") ?? undefined,
    reportDeadline: formData.get("reportDeadline") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) if (i.path[0]) fieldErrors[String(i.path[0])] ??= i.message;
    return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe", fieldErrors);
  }
  const { year, notes, ...dates } = parsed.data;
  const data = { ...dates, notes: notes ? notes : null };
  await db.federalYear.upsert({
    where: { tenantId_year: { tenantId: ctx.tenant.id, year } },
    create: { tenantId: ctx.tenant.id, year, ...data },
    update: data,
  });
  const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "–");
  await audit({
    tenantId: ctx.tenant.id,
    actorId: ctx.user.id,
    action: "federal.year.update",
    entity: "FederalYear",
    entityId: String(year),
    detail: `Fristen ${year}: Meldung ${fmt(dates.registrationDeadline)}, letzter Schiesstag ${fmt(dates.shootingDeadline)}, Resultate ${fmt(dates.reportDeadline)}`,
  });
  revalidatePath("/federal");
  return ok(undefined, "Gespeichert");
}

const startSchema = z.object({
  eventId: z.string().trim().min(1, "Anlass wählen").max(64),
  programId: z.string().trim().min(1, "Programm wählen").max(64),
  takeRsvps: z.boolean(),
});

/** Höchstzahl Teilnehmer, die aus den Anmeldungen übernommen werden. */
const MAX_FROM_RSVPS = 60;

/**
 * Durchgang für einen Obligatorisch-Anlass starten (Schützenmeister): verknüpft den Durchgang mit dem
 * Anlass (eventId) und übernimmt auf Wunsch die angemeldeten Mitglieder als Teilnehmer.
 */
export async function startFederalMatchAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireModule("federal");
  if (!ctx.can("results.verify")) return fail("Keine Berechtigung (Schützenmeister)");
  if (!ctx.hasModule("scores")) return fail("Bitte zuerst das Modul «Punkteerfassung» aktivieren.");
  const parsed = startSchema.safeParse({ eventId: formData.get("eventId"), programId: formData.get("programId"), takeRsvps: formData.get("takeRsvps") === "on" });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  const { eventId, programId, takeRsvps } = parsed.data;

  const event = await db.event.findFirst({
    where: { id: eventId, tenantId: ctx.tenant.id },
    select: { id: true, title: true, kind: true, startsAt: true, isCancelled: true, location: true, rsvps: { where: { status: "YES" }, select: { userId: true } } },
  });
  if (!event) return fail("Anlass nicht gefunden");
  if (event.kind !== "OBLIGATORY") return fail("Nur für Anlässe der Art «Obligatorisch».");
  if (event.isCancelled) return fail("Der Anlass ist abgesagt.");

  const programs = await listOfficialPrograms(ctx.tenant.id);
  const program = programs.find((p) => p.id === programId);
  if (!program) return fail("Programm nicht verfügbar (amtliches Programm wählen).");

  let userIds: string[] = [];
  if (takeRsvps && event.rsvps.length) {
    const members = await db.membership.findMany({
      where: { tenantId: ctx.tenant.id, userId: { in: event.rsvps.map((r) => r.userId) }, status: { not: "LEFT" }, user: { deletedAt: null } },
      select: { userId: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    });
    userIds = members.map((m) => m.userId).slice(0, MAX_FROM_RSVPS);
  }
  if (userIds.length === 0) userIds = [ctx.user.id];

  const match = await db.match.create({
    data: {
      tenantId: ctx.tenant.id,
      programId: program.id,
      createdById: ctx.user.id,
      eventId: event.id,
      title: event.title.slice(0, 80),
      date: event.startsAt,
      locationNote: event.location ? event.location.slice(0, 120) : null,
      participants: { create: userIds.map((userId, i) => ({ userId, sortOrder: i })) },
    },
    select: { id: true },
  });
  await audit({
    tenantId: ctx.tenant.id,
    actorId: ctx.user.id,
    action: "federal.match.start",
    entity: "Match",
    entityId: match.id,
    detail: `${event.title} · ${program.name} · ${userIds.length} Teilnehmer`,
  });
  revalidatePath("/federal");
  revalidatePath("/scores");
  redirect(`/scores/matches/${match.id}`);
}
