"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { generateOpaqueToken } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { zurichToUtc } from "@/lib/time";
import { requireLiveAdmin } from "./admin";

const idSchema = z.string().min(1).max(40);
const MAX_DAYS = 400;

const boardSchema = z.object({
  title: z.string().trim().min(1, "Titel fehlt").max(120, "Titel höchstens 120 Zeichen"),
  programId: z.string().max(40).nullable(),
  eventId: z.string().max(40).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum fehlt"),
  showDecimals: z.boolean(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Ablauf fehlt"),
});

function revalidate(id?: string) {
  revalidatePath("/admin/live");
  if (id) revalidatePath(`/admin/live/${id}`);
}

const opt = (fd: FormData, name: string) => {
  const v = String(fd.get(name) ?? "").trim();
  return v === "" ? null : v;
};

/** Live-Rangliste anlegen (ohne id) oder bearbeiten. Der Token bleibt beim Bearbeiten gleich. */
export async function saveLiveBoardAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireLiveAdmin();
  const tenantId = ctx.tenant.id;
  const rawId = opt(fd, "id");
  const id = rawId && idSchema.safeParse(rawId).success ? rawId : null;
  const parsed = boardSchema.safeParse({
    title: fd.get("title") ?? "",
    programId: opt(fd, "programId"),
    eventId: opt(fd, "eventId"),
    date: fd.get("date") ?? "",
    showDecimals: fd.get("showDecimals") === "on",
    expiresAt: fd.get("expiresAt") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0] ? String(issue.path[0]) : "";
    return fail(issue?.message ?? "Ungültige Eingabe", field ? { [field]: issue?.message ?? "" } : undefined);
  }
  const d = parsed.data;
  const [y, m, dd] = d.date.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, dd!));
  if (date.getUTCDate() !== dd) return fail("Ungültiges Datum.", { date: "Ungültiges Datum." });
  const expiresAt = zurichToUtc(d.expiresAt.slice(0, 10), d.expiresAt.slice(11, 16));
  if (Number.isNaN(expiresAt.getTime())) return fail("Ungültiger Ablauf.", { expiresAt: "Ungültiger Ablauf." });
  const now = Date.now();
  if (!id && expiresAt.getTime() <= now) return fail("Der Ablauf liegt in der Vergangenheit.", { expiresAt: "Liegt in der Vergangenheit." });
  if (expiresAt.getTime() > now + MAX_DAYS * 86_400_000) return fail(`Höchstens ${MAX_DAYS} Tage gültig.`, { expiresAt: `Höchstens ${MAX_DAYS} Tage.` });

  if (d.programId) {
    const p = await db.program.findFirst({ where: { id: d.programId, OR: [{ tenantId: null }, { tenantId }] }, select: { id: true } });
    if (!p) return fail("Programm nicht gefunden.", { programId: "Programm nicht gefunden." });
  }
  if (d.eventId) {
    const e = await db.event.findFirst({ where: { id: d.eventId, tenantId }, select: { id: true } });
    if (!e) return fail("Anlass nicht gefunden.", { eventId: "Anlass nicht gefunden." });
  }

  const data = { title: d.title, programId: d.programId, eventId: d.eventId, date, showDecimals: d.showDecimals, expiresAt };
  if (id) {
    const res = await db.liveBoard.updateMany({ where: { id, tenantId }, data });
    if (res.count === 0) return fail("Live-Rangliste nicht gefunden.");
    await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "liveboard.update", entity: "LiveBoard", entityId: id, detail: d.title });
    revalidate(id);
    return ok({ id }, "Gespeichert.");
  }
  const created = await db.liveBoard.create({ data: { tenantId, token: generateOpaqueToken(), ...data } });
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "liveboard.create", entity: "LiveBoard", entityId: created.id, detail: d.title });
  revalidate(created.id);
  return ok({ id: created.id }, "Live-Rangliste angelegt.");
}

/** Neuer geheimer Link: der alte funktioniert sofort nicht mehr (offene Bildschirme zeigen «nicht mehr gültig»). */
export async function regenerateLiveTokenAction(id: string): Promise<ActionResult> {
  const ctx = await requireLiveAdmin();
  if (!idSchema.safeParse(id).success) return fail("Ungültige Live-Rangliste.");
  const res = await db.liveBoard.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: { token: generateOpaqueToken() } });
  if (res.count === 0) return fail("Live-Rangliste nicht gefunden.");
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "liveboard.token.regenerate", entity: "LiveBoard", entityId: id });
  revalidate(id);
  return ok(undefined, "Neuer Link erstellt. Der alte Link ist ungültig.");
}

/** Sofort beenden (Ablauf = jetzt). */
export async function endLiveBoardAction(id: string): Promise<ActionResult> {
  const ctx = await requireLiveAdmin();
  if (!idSchema.safeParse(id).success) return fail("Ungültige Live-Rangliste.");
  const res = await db.liveBoard.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: { expiresAt: new Date() } });
  if (res.count === 0) return fail("Live-Rangliste nicht gefunden.");
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "liveboard.end", entity: "LiveBoard", entityId: id });
  revalidate(id);
  return ok(undefined, "Live-Rangliste beendet.");
}

export async function deleteLiveBoardAction(id: string): Promise<ActionResult> {
  const ctx = await requireLiveAdmin();
  if (!idSchema.safeParse(id).success) return fail("Ungültige Live-Rangliste.");
  const b = await db.liveBoard.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { title: true } });
  if (!b) return fail("Live-Rangliste nicht gefunden.");
  await db.liveBoard.deleteMany({ where: { id, tenantId: ctx.tenant.id } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "liveboard.delete", entity: "LiveBoard", entityId: id, detail: b.title });
  revalidate();
  redirect("/admin/live");
}
