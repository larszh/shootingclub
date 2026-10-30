"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireChampionshipAdmin } from "./guard";
import { dbFromDay, getChampionship, loadRanking } from "./queries";
import { championshipSchema, parseCategories, type ChampionshipInput } from "./types";

const idSchema = z.string().min(1).max(40);

function revalidate(id?: string) {
  revalidatePath("/championship");
  if (id) revalidatePath(`/championship/${id}`, "layout");
}

const text = (fd: FormData, name: string) => {
  const v = String(fd.get(name) ?? "").trim();
  return v === "" ? null : v;
};

function parseForm(fd: FormData): { ok: true; data: ChampionshipInput } | { ok: false; result: ActionResult<never> } {
  let programs: unknown = [];
  try {
    programs = JSON.parse(String(fd.get("programs") ?? "[]"));
  } catch {
    programs = [];
  }
  const parsed = championshipSchema.safeParse({
    name: fd.get("name") ?? "",
    year: fd.get("year") ?? "",
    startsOn: fd.get("startsOn") ?? "",
    endsOn: fd.get("endsOn") ?? "",
    bestOf: text(fd, "bestOf"),
    officialOnly: fd.get("officialOnly") === "on",
    categoriesText: text(fd, "categoriesText"),
    rulesText: text(fd, "rulesText"),
    programs,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0] ? String(issue.path[0]) : "";
    return { ok: false, result: fail(issue?.message ?? "Ungültige Eingabe", field ? { [field]: issue?.message ?? "" } : undefined) };
  }
  const d = parsed.data;
  const cat = parseCategories(d.categoriesText);
  if (cat.errors.length) return { ok: false, result: fail(cat.errors[0]!, { categoriesText: cat.errors.join(" ") }) };
  const ids = d.programs.map((p) => p.programId);
  if (new Set(ids).size !== ids.length) return { ok: false, result: fail("Ein Programm ist doppelt gewählt.", { programs: "Ein Programm ist doppelt gewählt." }) };
  const startYear = Number(d.startsOn.slice(0, 4));
  if (Math.abs(startYear - d.year) > 1) return { ok: false, result: fail("Zeitraum passt nicht zum Jahr.", { startsOn: "Zeitraum passt nicht zum Jahr." }) };
  return { ok: true, data: d };
}

/** Anlegen (ohne id) oder Bearbeiten einer Meisterschaft samt Programmen. */
export async function saveChampionshipAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireChampionshipAdmin();
  const tenantId = ctx.tenant.id;
  const rawId = fd.get("id") ? String(fd.get("id")) : null;
  const id = rawId && idSchema.safeParse(rawId).success ? rawId : null;
  const p = parseForm(fd);
  if (!p.ok) return p.result;
  const d = p.data;

  // Nur Programme, die im Verein sichtbar sind (global oder eigene)
  const allowed = await db.program.findMany({ where: { id: { in: d.programs.map((x) => x.programId) }, OR: [{ tenantId: null }, { tenantId }] }, select: { id: true } });
  if (allowed.length !== d.programs.length) return fail("Ein gewähltes Programm gibt es nicht (mehr).", { programs: "Programm nicht gefunden." });

  const startsOn = dbFromDay(d.startsOn);
  const endsOn = dbFromDay(d.endsOn);
  if (!startsOn || !endsOn) return fail("Ungültiges Datum.");
  const data = {
    name: d.name, year: d.year, startsOn, endsOn, bestOf: d.bestOf, officialOnly: d.officialOnly,
    categoriesText: d.categoriesText, rulesText: d.rulesText,
  };

  try {
    const savedId = await db.$transaction(async (tx) => {
      let cid: string;
      if (id) {
        const res = await tx.championship.updateMany({ where: { id, tenantId }, data });
        if (res.count === 0) return null;
        cid = id;
        await tx.championshipProgram.deleteMany({ where: { championshipId: cid, programId: { notIn: d.programs.map((x) => x.programId) } } });
      } else {
        const created = await tx.championship.create({ data: { tenantId, ...data } });
        cid = created.id;
      }
      for (const prog of d.programs) {
        const values = { required: prog.required, weight: prog.weight, maxCount: prog.maxCount };
        await tx.championshipProgram.upsert({
          where: { championshipId_programId: { championshipId: cid, programId: prog.programId } },
          create: { championshipId: cid, programId: prog.programId, ...values },
          update: values,
        });
      }
      return cid;
    });
    if (!savedId) return fail("Meisterschaft nicht gefunden.");
    await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: id ? "championship.update" : "championship.create", entity: "Championship", entityId: savedId, detail: `${d.name} (${d.year}), ${d.programs.length} Programme` });
    revalidate(savedId);
    return ok({ id: savedId }, id ? "Gespeichert." : "Meisterschaft angelegt.");
  } catch (e) {
    console.error("Meisterschaft speichern:", e);
    return fail("Das hat nicht geklappt. Bitte nochmals versuchen.");
  }
}

/** Veröffentlichen bzw. zurückziehen. Beim Veröffentlichen erhalten die Rangierten eine Push-Mitteilung. */
export async function setChampionshipPublishedAction(id: string, published: boolean): Promise<ActionResult> {
  const ctx = await requireChampionshipAdmin();
  if (!idSchema.safeParse(id).success) return fail("Ungültige Meisterschaft.");
  const tenantId = ctx.tenant.id;
  const res = await db.championship.updateMany({ where: { id, tenantId }, data: { isPublished: !!published } });
  if (res.count === 0) return fail("Meisterschaft nicht gefunden.");
  const c = await getChampionship(tenantId, id);
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: published ? "championship.publish" : "championship.unpublish", entity: "Championship", entityId: id, detail: c?.name });
  if (published && c) {
    try {
      const { ranking } = await loadRanking(tenantId, c);
      const rankedIds = [...ranking.ranked, ...ranking.unclassified].map((e) => e.userId);
      // Ausgetretene Mitglieder bleiben in der Rangliste, erhalten aber keine Mitteilung.
      const active = rankedIds.length
        ? await db.membership.findMany({ where: { tenantId, userId: { in: rankedIds }, status: { not: "LEFT" }, user: { deletedAt: null } }, select: { userId: true } })
        : [];
      const userIds = active.map((m) => m.userId);
      if (userIds.length) {
        await notify({
          tenantId, userIds, topic: "announcements", email: false,
          title: `Rangliste ${c.name}`, body: "Die Rangliste ist veröffentlicht. Schau dir deinen Stand an.",
          url: `/championship/${id}`, tag: `championship:${id}`,
        });
      }
    } catch (e) {
      console.warn("Meisterschaft: Mitteilung fehlgeschlagen", e);
    }
  }
  revalidate(id);
  return ok(undefined, published ? "Rangliste veröffentlicht." : "Rangliste zurückgezogen.");
}

export async function deleteChampionshipAction(id: string): Promise<ActionResult> {
  const ctx = await requireChampionshipAdmin();
  if (!idSchema.safeParse(id).success) return fail("Ungültige Meisterschaft.");
  const tenantId = ctx.tenant.id;
  const c = await db.championship.findFirst({ where: { id, tenantId }, select: { name: true, year: true } });
  if (!c) return fail("Meisterschaft nicht gefunden.");
  await db.championship.deleteMany({ where: { id, tenantId } });
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "championship.delete", entity: "Championship", entityId: id, detail: `${c.name} (${c.year})` });
  revalidate();
  redirect("/championship");
}

/** Kopie fürs Folgejahr: gleiche Programme, Kategorien und Regeln, Zeitraum um ein Jahr verschoben, unveröffentlicht. */
export async function copyChampionshipToNextYearAction(id: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireChampionshipAdmin();
  if (!idSchema.safeParse(id).success) return fail("Ungültige Meisterschaft.");
  const tenantId = ctx.tenant.id;
  const c = await getChampionship(tenantId, id);
  if (!c) return fail("Meisterschaft nicht gefunden.");
  const shift = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    // 29. Februar → 28. Februar
    const dt = new Date(Date.UTC(y! + 1, m! - 1, Math.min(d!, m === 2 ? 28 : d!)));
    return dt;
  };
  const year = c.year + 1;
  const name = c.name.includes(String(c.year)) ? c.name.replace(String(c.year), String(year)) : c.name;
  const created = await db.championship.create({
    data: {
      tenantId, name: name.slice(0, 120), year, startsOn: shift(c.startsOn), endsOn: shift(c.endsOn), bestOf: c.bestOf, officialOnly: c.officialOnly,
      categoriesText: c.categoriesText || null, rulesText: c.rulesText || null, isPublished: false,
      programs: { create: c.programs.map((p) => ({ programId: p.programId, required: p.required, weight: p.weight, maxCount: p.maxCount })) },
    },
  });
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "championship.create", entity: "Championship", entityId: created.id, detail: `Kopie von ${c.name} für ${year}` });
  revalidate(created.id);
  return ok({ id: created.id }, `Meisterschaft ${year} angelegt.`);
}
