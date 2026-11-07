"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { todayZurich } from "@/lib/time";
import { getRequestLocale, getT } from "@/lib/i18n";
import { decideJoin, type JoinDecision } from "./join-approval";

function revalidateMembers() {
  revalidatePath("/admin/members", "layout");
  revalidatePath("/members");
}

/** Beitrittsgesuch freigeben (PENDING → ACTIVE) oder ablehnen (Mitgliedschaft wird gelöscht). */
async function decide(membershipId: string, decision: Exclude<JoinDecision, "WITHDRAW">, reason?: string): Promise<ActionResult> {
  const ctx = await requirePermission("members.approve");
  if (typeof membershipId !== "string" || !membershipId || membershipId.length > 40) return fail("Nicht gefunden");
  const m = await db.membership.findUnique({ where: { id: membershipId }, include: { user: { select: { id: true, name: true } } } });
  if (!m || m.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  const t = decideJoin(m.status, decision);
  if (!t.ok) return fail("Diese Anfrage ist bereits entschieden.");
  const note = reason?.trim().slice(0, 191) || "";

  if (t.next === "ACTIVE") {
    // Bedingt auf PENDING: bei gleichzeitiger Entscheidung gewinnt nur eine.
    const res = await db.membership.updateMany({ where: { id: m.id, status: "PENDING" }, data: { status: "ACTIVE", joinedAt: m.joinedAt ?? new Date(`${todayZurich()}T00:00:00Z`) } });
    if (res.count === 0) return fail("Diese Anfrage ist bereits entschieden.");
    await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "member.join.approve", entity: "Membership", entityId: m.id, detail: m.user.name });
    await notify({
      tenantId: ctx.tenant.id, userIds: [m.userId], topic: "system",
      title: "Beitritt freigegeben", body: `Willkommen bei ${ctx.tenant.name}! Du hast jetzt Zugang.`, url: "/",
      i18n: { title: "bookings.join.notify.approved.title", body: "bookings.join.notify.approved.body", vars: { club: ctx.tenant.name } },
      dedupeKey: `join-approved:${m.id}`,
    });
    revalidateMembers();
    return ok(undefined, `${m.user.name} ist jetzt Mitglied.`);
  }

  // Ablehnung: zuerst benachrichtigen (die Mitteilung braucht die Mitgliedschaft im Verein), dann löschen.
  const res = await db.membership.findFirst({ where: { id: m.id, status: "PENDING" }, select: { id: true } });
  if (!res) return fail("Diese Anfrage ist bereits entschieden.");
  await notify({
    tenantId: ctx.tenant.id, userIds: [m.userId], topic: "system",
    title: "Beitritt abgelehnt", body: `${ctx.tenant.name} hat deine Beitrittsanfrage abgelehnt.${note ? ` Grund: ${note}` : ""}`, url: "/onboarding",
    push: true,
    includePending: true, // die Person hat (noch) keinen Zugang, soll die Ablehnung aber erhalten
    footer: "joinRequest",
    i18n: { title: "bookings.join.notify.rejected.title", body: note ? "bookings.join.notify.rejected.bodyReason" : "bookings.join.notify.rejected.body", vars: { club: ctx.tenant.name, reason: note } },
    dedupeKey: `join-rejected:${m.id}`,
  });
  const del = await db.membership.deleteMany({ where: { id: m.id, status: "PENDING" } });
  if (del.count === 0) return fail("Diese Anfrage ist bereits entschieden.");
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "member.join.reject", entity: "Membership", entityId: m.id, detail: `${m.user.name}${note ? `: ${note}` : ""}` });
  revalidateMembers();
  return ok(undefined, `Anfrage von ${m.user.name} abgelehnt.`);
}

export async function approveJoinRequestAction(membershipId: string): Promise<ActionResult> {
  return decide(membershipId, "APPROVE");
}

export async function rejectJoinRequestAction(membershipId: string, reason?: string): Promise<ActionResult> {
  return decide(membershipId, "REJECT", typeof reason === "string" ? reason : undefined);
}

/** Die Person zieht ihre eigene offene Anfrage zurück (Warteseite). */
export async function withdrawJoinRequestAction(membershipId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = getT(await getRequestLocale());
  if (typeof membershipId !== "string" || !membershipId || membershipId.length > 40) return fail(t("bookings.err.notFound"));
  const m = await db.membership.findUnique({ where: { id: membershipId }, select: { id: true, userId: true, tenantId: true, status: true } });
  if (!m || m.userId !== user.id) return fail(t("bookings.err.notFound"));
  const tr = decideJoin(m.status, "WITHDRAW");
  if (!tr.ok) return fail(t("bookings.join.err.decided"));
  const del = await db.membership.deleteMany({ where: { id: m.id, userId: user.id, status: "PENDING" } });
  if (del.count === 0) return fail(t("bookings.join.err.decided"));
  await audit({ tenantId: m.tenantId, actorId: user.id, actorName: user.name, action: "member.join.withdraw", entity: "Membership", entityId: m.id, detail: user.name });
  revalidatePath("/onboarding");
  revalidatePath("/admin/members/requests");
  return ok(undefined, t("bookings.join.withdraw.done"));
}

/** Vereinseinstellung «Beitritt mit Freigabe» (Beitrittscode erzeugt dann eine Anfrage). */
export async function setJoinApprovalAction(enabled: boolean): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  if (typeof enabled !== "boolean") return fail("Ungültige Eingabe");
  await db.tenant.update({ where: { id: ctx.tenant.id }, data: { joinApproval: enabled } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "tenant.joinApproval", entity: "Tenant", entityId: ctx.tenant.id, detail: enabled ? "Beitritt mit Freigabe eingeschaltet" : "Beitritt mit Freigabe ausgeschaltet" });
  revalidatePath("/admin/members/requests");
  revalidatePath("/admin");
  return ok(undefined, enabled ? "Neue Beitritte per Code warten jetzt auf Freigabe." : "Beitritt per Code gilt wieder sofort.");
}
