"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { addDays, todayZurich, zurichToUtc } from "@/lib/time";
import { announcementSchema, computeTimes, daysBetween, eventFormSchema, recurrenceDates, rsvpSchema, type EventTimes } from "./types";
import { getBaseUrl, tenantFeedPath, userFeedPath } from "./queries";

function revalidateEvents(eventId?: string) {
  revalidatePath("/events");
  revalidatePath("/admin/events");
  revalidatePath("/");
  if (eventId) revalidatePath(`/events/${eventId}`);
}

function zodFieldErrors(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

async function requireManager() {
  const ctx = await requireModule("events");
  if (!ctx.can("events.manage")) return null;
  return ctx;
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : undefined;
};

// ---------------------------------------------------------------------------
// Anlässe verwalten
// ---------------------------------------------------------------------------

export async function saveEventAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireManager();
  if (!ctx) return fail("Du darfst keine Anlässe verwalten.");

  const parsed = eventFormSchema.safeParse({
    id: str(formData, "id"),
    title: str(formData, "title") ?? "",
    kind: str(formData, "kind"),
    date: str(formData, "date") ?? "",
    allDay: formData.get("allDay") === "on",
    timeFrom: str(formData, "timeFrom"),
    timeTo: str(formData, "timeTo"),
    endDate: str(formData, "endDate"),
    location: str(formData, "location"),
    description: str(formData, "description"),
    rsvpEnabled: formData.get("rsvpEnabled") === "on",
    capacity: str(formData, "capacity"),
    deadlineDate: str(formData, "deadlineDate"),
    deadlineTime: str(formData, "deadlineTime"),
    repeat: str(formData, "repeat") || "NONE",
    repeatMode: str(formData, "repeatMode") || "COUNT",
    repeatCount: str(formData, "repeatCount"),
    repeatUntil: str(formData, "repeatUntil"),
  });
  if (!parsed.success) {
    const fe = zodFieldErrors(parsed.error.issues);
    return fail(Object.values(fe)[0] ?? "Bitte Eingaben prüfen.", fe);
  }
  const input = parsed.data;
  const deadlineOffset = input.rsvpEnabled && input.deadlineDate ? daysBetween(input.date, input.deadlineDate) : null;

  const base = {
    title: input.title,
    kind: input.kind,
    allDay: input.allDay,
    location: input.location ?? null,
    description: input.description ?? null,
    rsvpEnabled: input.rsvpEnabled,
    capacity: input.rsvpEnabled ? (input.capacity ?? null) : null,
  };

  if (input.id) {
    const existing = await db.event.findFirst({ where: { id: input.id, tenantId: ctx.tenant.id }, select: { id: true } });
    if (!existing) return fail("Anlass nicht gefunden.");
    const times = computeTimes(input, input.date, deadlineOffset);
    if ("error" in times) return fail(times.error, { [times.field]: times.error });
    await db.event.update({ where: { id: existing.id }, data: { ...base, ...times } });
    revalidateEvents(existing.id);
    redirect(`/events/${existing.id}?saved=1`);
  }

  const dates = recurrenceDates(input);
  if (!Array.isArray(dates)) return fail(dates.error, { [dates.field]: dates.error });
  const all: EventTimes[] = [];
  for (const d of dates) {
    const t = computeTimes(input, d, deadlineOffset);
    if ("error" in t) return fail(t.error, { [t.field]: t.error });
    all.push(t);
  }

  if (all.length === 1) {
    const created = await db.event.create({ data: { ...base, ...all[0]!, tenantId: ctx.tenant.id, createdById: ctx.user.id } });
    revalidateEvents(created.id);
    redirect(`/events/${created.id}?created=1`);
  }
  await db.event.createMany({ data: all.map((t) => ({ ...base, ...t, tenantId: ctx.tenant.id, createdById: ctx.user.id })) });
  revalidateEvents();
  redirect(`/admin/events?series=${all.length}`);
}

export async function setEventCancelledAction(eventId: string, cancelled: boolean): Promise<ActionResult> {
  const ctx = await requireManager();
  if (!ctx) return fail("Keine Berechtigung.");
  const res = await db.event.updateMany({ where: { id: String(eventId), tenantId: ctx.tenant.id }, data: { isCancelled: !!cancelled } });
  if (res.count === 0) return fail("Anlass nicht gefunden.");
  revalidateEvents(eventId);
  return ok(undefined, cancelled ? "Anlass abgesagt." : "Anlass findet wieder statt.");
}

export async function deleteEventAction(eventId: string): Promise<ActionResult> {
  const ctx = await requireManager();
  if (!ctx) return fail("Keine Berechtigung.");
  const res = await db.event.deleteMany({ where: { id: String(eventId), tenantId: ctx.tenant.id } });
  if (res.count === 0) return fail("Anlass nicht gefunden.");
  revalidateEvents(eventId);
  return ok(undefined, "Anlass gelöscht.");
}

// ---------------------------------------------------------------------------
// An- und Abmeldung
// ---------------------------------------------------------------------------

export async function rsvpAction(input: { eventId: string; status: string; guests?: number; note?: string }): Promise<ActionResult> {
  const ctx = await requireModule("events");
  const parsed = rsvpSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  const { eventId, status, note } = parsed.data;
  const guests = status === "NO" ? 0 : parsed.data.guests;

  const event = await db.event.findFirst({ where: { id: eventId, tenantId: ctx.tenant.id } });
  if (!event) return fail("Anlass nicht gefunden.");
  const now = new Date();
  if (!event.rsvpEnabled) return fail("Für diesen Anlass gibt es keine Anmeldung.");
  if (event.isCancelled) return fail("Der Anlass wurde abgesagt.");
  if (event.startsAt.getTime() <= now.getTime()) return fail("Der Anlass hat bereits begonnen.");
  if (event.rsvpDeadline && event.rsvpDeadline.getTime() < now.getTime()) return fail("Die Anmeldefrist ist abgelaufen.");

  const result = await db.$transaction(async (tx) => {
    if (status === "YES" && event.capacity !== null) {
      // Zeile sperren, damit parallele Zusagen die Kapazität nicht gemeinsam überschreiten
      await tx.$queryRaw`SELECT id FROM \`Event\` WHERE id = ${event.id} FOR UPDATE`;
      const others = await tx.eventRsvp.aggregate({
        where: { eventId: event.id, status: "YES", NOT: { userId: ctx.user.id } },
        _count: { _all: true },
        _sum: { guests: true },
      });
      const taken = others._count._all + (others._sum.guests ?? 0);
      const free = event.capacity - taken;
      if (1 + guests > free) {
        return free > 0
          ? fail(`Es hat nur noch ${free} ${free === 1 ? "Platz" : "Plätze"} frei. Bitte weniger Begleitpersonen angeben.`)
          : fail("Leider ausgebucht. Melde dich mit «Vielleicht» an, dann kommst du auf die Warteliste.");
      }
    }
    await tx.eventRsvp.upsert({
      where: { eventId_userId: { eventId: event.id, userId: ctx.user.id } },
      update: { status, guests, note: note ?? null },
      create: { eventId: event.id, userId: ctx.user.id, status, guests, note: note ?? null },
    });
    return null;
  });
  if (result) return result;
  revalidateEvents(event.id);
  const msg = status === "YES" ? "Super, du bist angemeldet!" : status === "MAYBE" ? "Gespeichert: vielleicht." : "Du hast dich abgemeldet.";
  return ok(undefined, msg);
}

// ---------------------------------------------------------------------------
// Mitteilungen
// ---------------------------------------------------------------------------

async function requireAnnouncer() {
  const ctx = await requireModule("events");
  if (!ctx.can("announcements.manage")) return null;
  return ctx;
}

export async function saveAnnouncementAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAnnouncer();
  if (!ctx) return fail("Du darfst keine Mitteilungen verwalten.");
  const parsed = announcementSchema.safeParse({
    id: str(formData, "id"),
    title: str(formData, "title") ?? "",
    body: str(formData, "body") ?? "",
    pinned: formData.get("pinned") === "on",
    expiresOn: str(formData, "expiresOn"),
  });
  if (!parsed.success) {
    const fe = zodFieldErrors(parsed.error.issues);
    return fail(Object.values(fe)[0] ?? "Bitte Eingaben prüfen.", fe);
  }
  const { id, title, body, pinned, expiresOn } = parsed.data;
  // Neue Mitteilungen dürfen nicht schon abgelaufen sein (beim Bearbeiten ist ein Datum in der Vergangenheit erlaubt, um sie auszublenden)
  if (!id && expiresOn && expiresOn < todayZurich()) {
    return fail("«Sichtbar bis» darf nicht in der Vergangenheit liegen.", { expiresOn: "«Sichtbar bis» darf nicht in der Vergangenheit liegen." });
  }
  // Ablauf am Ende des gewählten Tages (Schweizer Zeit)
  const expiresAt = expiresOn ? zurichToUtc(addDays(expiresOn, 1), "00:00") : null;
  if (id) {
    const res = await db.announcement.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: { title, body, pinned, expiresAt } });
    if (res.count === 0) return fail("Mitteilung nicht gefunden.");
  } else {
    await db.announcement.create({ data: { tenantId: ctx.tenant.id, authorId: ctx.user.id, title, body, pinned, expiresAt } });
  }
  revalidateEvents();
  redirect("/admin/events/announcements?saved=1");
}

export async function toggleAnnouncementPinAction(id: string): Promise<ActionResult> {
  const ctx = await requireAnnouncer();
  if (!ctx) return fail("Keine Berechtigung.");
  const a = await db.announcement.findFirst({ where: { id: String(id), tenantId: ctx.tenant.id }, select: { id: true, pinned: true } });
  if (!a) return fail("Mitteilung nicht gefunden.");
  await db.announcement.update({ where: { id: a.id }, data: { pinned: !a.pinned } });
  revalidateEvents();
  return ok(undefined, a.pinned ? "Nicht mehr angeheftet." : "Angeheftet.");
}

export async function deleteAnnouncementAction(id: string): Promise<ActionResult> {
  const ctx = await requireAnnouncer();
  if (!ctx) return fail("Keine Berechtigung.");
  const res = await db.announcement.deleteMany({ where: { id: String(id), tenantId: ctx.tenant.id } });
  if (res.count === 0) return fail("Mitteilung nicht gefunden.");
  revalidateEvents();
  return ok(undefined, "Mitteilung gelöscht.");
}

// ---------------------------------------------------------------------------
// Kalender-Abos
// ---------------------------------------------------------------------------

function newToken() {
  return randomBytes(32).toString("base64url");
}

export type FeedLink = { url: string };

/** Erstellt den Vereins-Feed bei Bedarf (jedes Mitglied darf ihn abrufen). */
export async function ensureTenantFeedAction(): Promise<ActionResult<FeedLink>> {
  const ctx = await requireModule("events");
  const t = await db.tenant.findUnique({ where: { id: ctx.tenant.id }, select: { calendarToken: true } });
  let token = t?.calendarToken ?? null;
  if (!token) {
    token = newToken();
    // Nur setzen, wenn noch keiner existiert (parallel erzeugte Tokens nicht überschreiben)
    await db.tenant.updateMany({ where: { id: ctx.tenant.id, calendarToken: null }, data: { calendarToken: token } });
    const again = await db.tenant.findUnique({ where: { id: ctx.tenant.id }, select: { calendarToken: true } });
    token = again?.calendarToken ?? token;
  }
  revalidatePath("/events");
  return ok({ url: (await getBaseUrl()) + tenantFeedPath(token) });
}

export async function regenerateTenantFeedAction(): Promise<ActionResult<FeedLink>> {
  const ctx = await requireModule("events");
  if (!ctx.can("tenant.manage")) return fail("Nur Admins können den Vereins-Link erneuern.");
  const token = newToken();
  await db.tenant.update({ where: { id: ctx.tenant.id }, data: { calendarToken: token } });
  revalidatePath("/events");
  revalidatePath("/admin/events");
  return ok({ url: (await getBaseUrl()) + tenantFeedPath(token) }, "Neuer Link erstellt. Der alte Link funktioniert nicht mehr.");
}

export async function ensureMyFeedAction(): Promise<ActionResult<FeedLink>> {
  const ctx = await requireModule("events");
  const u = await db.user.findUnique({ where: { id: ctx.user.id }, select: { calendarToken: true } });
  let token = u?.calendarToken ?? null;
  if (!token) {
    token = newToken();
    await db.user.updateMany({ where: { id: ctx.user.id, calendarToken: null }, data: { calendarToken: token } });
    const again = await db.user.findUnique({ where: { id: ctx.user.id }, select: { calendarToken: true } });
    token = again?.calendarToken ?? token;
  }
  revalidatePath("/events");
  return ok({ url: (await getBaseUrl()) + userFeedPath(token) });
}

export async function regenerateMyFeedAction(): Promise<ActionResult<FeedLink>> {
  const ctx = await requireModule("events");
  const token = newToken();
  await db.user.update({ where: { id: ctx.user.id }, data: { calendarToken: token } });
  revalidatePath("/events");
  return ok({ url: (await getBaseUrl()) + userFeedPath(token) }, "Neuer Link erstellt. Der alte Link funktioniert nicht mehr.");
}
