"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { publishChat } from "./bus";
import {
  deleteMessage,
  editMessage,
  ensureGroupAdmin,
  getConversationAccess,
  isTenantMember,
  syncAllClubMembers,
  type ConversationAccess,
} from "./service";
import { clubKeyFor, directKeyFor, groupTitleSchema, idSchema, isClubKey, messageBodySchema, type ChatMessageDTO } from "./types";

/** Chat-Kontext: Modul aktiv und echtes Vereinsmitglied (Super-Admins ohne Mitgliedschaft lesen keine Chats). */
async function chatCtx() {
  const ctx = await requireModule("chat");
  if (!ctx.tenant.role) return null;
  return ctx;
}

type Ctx = NonNullable<Awaited<ReturnType<typeof chatCtx>>>;

function revalidateChat(conversationId?: string) {
  revalidatePath("/chat");
  if (conversationId) revalidatePath(`/chat/${conversationId}`);
}

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

async function groupAccess(ctx: Ctx, conversationId: string, needAdmin: boolean): Promise<ConversationAccess | string> {
  const parsed = idSchema.safeParse(conversationId);
  if (!parsed.success) return "Unterhaltung nicht gefunden.";
  const access = await getConversationAccess(ctx.user.id, parsed.data, ctx.tenant.id);
  if (!access) return "Unterhaltung nicht gefunden.";
  if (access.conversation.kind !== "GROUP") return "Nur in Gruppen möglich.";
  if (needAdmin && access.member.role !== "ADMIN") return "Nur Gruppen-Admins dürfen das.";
  return access;
}

/** Nur Benutzer, die (noch) Mitglied des Vereins sind. */
async function filterTenantMembers(tenantId: string, userIds: string[]) {
  const unique = [...new Set(userIds)].filter((id) => typeof id === "string" && id.length > 0 && id.length <= 64);
  if (!unique.length) return [];
  const rows = await db.membership.findMany({ where: { tenantId, userId: { in: unique } }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

/* ------------------------------------------------------------ Unterhaltungen */

/** 1:1-Unterhaltung öffnen oder anlegen (eindeutig pro Paar). */
export async function startDirectChatAction(otherUserId: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await chatCtx();
  if (!ctx) return fail("Der Chat ist nur für Vereinsmitglieder.");
  const parsed = idSchema.safeParse(otherUserId);
  if (!parsed.success || parsed.data === ctx.user.id) return fail("Bitte ein anderes Mitglied wählen.");
  if (!(await isTenantMember(parsed.data, ctx.tenant.id))) return fail("Diese Person ist nicht im Verein.");

  const directKey = directKeyFor(ctx.tenant.id, ctx.user.id, parsed.data);
  let conv = await db.chatConversation.findUnique({ where: { directKey }, select: { id: true } });
  if (!conv) {
    try {
      conv = await db.chatConversation.create({
        data: {
          tenantId: ctx.tenant.id,
          kind: "DIRECT",
          directKey,
          createdById: ctx.user.id,
          members: { create: [{ userId: ctx.user.id }, { userId: parsed.data }] },
        },
        select: { id: true },
      });
      publishChat({ type: "conversation", tenantId: ctx.tenant.id, conversationId: conv.id });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      conv = await db.chatConversation.findUnique({ where: { directKey }, select: { id: true } });
      if (!conv) return fail("Die Unterhaltung konnte nicht geöffnet werden.");
    }
  }
  // Eigene Mitgliedschaft sicherstellen (falls die Unterhaltung früher entfernt wurde).
  await db.chatMember.upsert({
    where: { conversationId_userId: { conversationId: conv.id, userId: ctx.user.id } },
    create: { conversationId: conv.id, userId: ctx.user.id },
    update: {},
  });
  revalidateChat();
  return ok({ id: conv.id });
}

const createGroupSchema = z.object({
  title: groupTitleSchema,
  club: z.boolean(),
  sync: z.boolean(),
  members: z.array(z.string().min(1).max(64)).max(1000),
});

/** Neue Gruppe; Ersteller wird Admin. Vereins-Gruppe (alle Mitglieder) nur mit tenant.manage. */
export async function createGroupAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await chatCtx();
  if (!ctx) return fail("Der Chat ist nur für Vereinsmitglieder.");
  const parsed = createGroupSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    club: formData.get("club") === "on",
    sync: formData.get("sync") === "on",
    members: formData.getAll("member").map(String),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? "form");
    return fail(issue?.message ?? "Bitte Eingaben prüfen.", { [field]: issue?.message ?? "" });
  }
  const input = parsed.data;
  if (input.club && !ctx.can("tenant.manage")) return fail("Nur Vereins-Admins dürfen eine Vereins-Gruppe erstellen.");

  let memberIds: string[];
  if (input.club) {
    const all = await db.membership.findMany({ where: { tenantId: ctx.tenant.id }, select: { userId: true } });
    memberIds = all.map((m) => m.userId);
  } else {
    memberIds = await filterTenantMembers(ctx.tenant.id, input.members);
    if (!memberIds.filter((id) => id !== ctx.user.id).length) return fail("Bitte mindestens ein Mitglied wählen.", { members: "Bitte mindestens ein Mitglied wählen." });
  }
  const others = memberIds.filter((id) => id !== ctx.user.id);

  const directKey = input.club && input.sync ? clubKeyFor(ctx.tenant.id) : null;
  let created: { id: string };
  try {
    created = await db.chatConversation.create({
      data: {
        tenantId: ctx.tenant.id,
        kind: "GROUP",
        title: input.title,
        directKey,
        createdById: ctx.user.id,
        members: { create: [{ userId: ctx.user.id, role: "ADMIN" }, ...others.map((userId) => ({ userId }))] },
      },
      select: { id: true },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return fail("Es gibt bereits eine synchronisierte Vereins-Gruppe.", { sync: "Es gibt bereits eine synchronisierte Vereins-Gruppe." });
    throw e;
  }
  publishChat({ type: "conversation", tenantId: ctx.tenant.id, conversationId: created.id });
  revalidateChat();
  return ok({ id: created.id }, "Gruppe erstellt.");
}

export async function renameGroupAction(conversationId: string, title: string): Promise<ActionResult> {
  const ctx = await chatCtx();
  if (!ctx) return fail("Keine Berechtigung.");
  const access = await groupAccess(ctx, conversationId, true);
  if (typeof access === "string") return fail(access);
  const parsed = groupTitleSchema.safeParse(title);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültiger Name.");
  await db.chatConversation.update({ where: { id: access.conversation.id }, data: { title: parsed.data } });
  publishChat({ type: "conversation", tenantId: ctx.tenant.id, conversationId: access.conversation.id });
  revalidateChat(access.conversation.id);
  return ok(undefined, "Gruppe umbenannt.");
}

export async function addGroupMembersAction(conversationId: string, userIds: string[]): Promise<ActionResult<{ added: number }>> {
  const ctx = await chatCtx();
  if (!ctx) return fail("Keine Berechtigung.");
  const access = await groupAccess(ctx, conversationId, true);
  if (typeof access === "string") return fail(access);
  if (!Array.isArray(userIds) || userIds.length > 1000) return fail("Ungültige Auswahl.");
  const valid = await filterTenantMembers(ctx.tenant.id, userIds);
  if (!valid.length) return fail("Bitte mindestens ein Vereinsmitglied wählen.");
  // Hinzugefügte (auch ehemalige) Mitglieder starten ohne ungelesenen Altbestand.
  const lastReadAt = new Date();
  const res = await db.chatMember.createMany({ data: valid.map((userId) => ({ conversationId: access.conversation.id, userId, lastReadAt })), skipDuplicates: true });
  publishChat({ type: "conversation", tenantId: ctx.tenant.id, conversationId: access.conversation.id });
  revalidateChat(access.conversation.id);
  return ok({ added: res.count }, res.count === 1 ? "1 Mitglied hinzugefügt." : `${res.count} Mitglieder hinzugefügt.`);
}

export async function removeGroupMemberAction(conversationId: string, userId: string): Promise<ActionResult> {
  const ctx = await chatCtx();
  if (!ctx) return fail("Keine Berechtigung.");
  const access = await groupAccess(ctx, conversationId, true);
  if (typeof access === "string") return fail(access);
  if (userId === ctx.user.id) return fail("Zum Austreten bitte «Gruppe verlassen» verwenden.");
  if (isClubKey(access.conversation.directKey)) return fail("Aus der synchronisierten Vereins-Gruppe kann niemand entfernt werden. Synchronisierung zuerst ausschalten.");
  const res = await db.chatMember.deleteMany({ where: { conversationId: access.conversation.id, userId: String(userId) } });
  if (res.count === 0) return fail("Mitglied nicht gefunden.");
  publishChat({ type: "conversation", tenantId: ctx.tenant.id, conversationId: access.conversation.id });
  revalidateChat(access.conversation.id);
  return ok(undefined, "Mitglied entfernt.");
}

export async function setGroupAdminAction(conversationId: string, userId: string, admin: boolean): Promise<ActionResult> {
  const ctx = await chatCtx();
  if (!ctx) return fail("Keine Berechtigung.");
  const access = await groupAccess(ctx, conversationId, true);
  if (typeof access === "string") return fail(access);
  if (!admin && userId === ctx.user.id) {
    const admins = await db.chatMember.count({ where: { conversationId: access.conversation.id, role: "ADMIN" } });
    if (admins <= 1) return fail("Die Gruppe braucht mindestens einen Admin.");
  }
  const res = await db.chatMember.updateMany({ where: { conversationId: access.conversation.id, userId: String(userId) }, data: { role: admin ? "ADMIN" : "MEMBER" } });
  if (res.count === 0) return fail("Mitglied nicht gefunden.");
  publishChat({ type: "conversation", tenantId: ctx.tenant.id, conversationId: access.conversation.id });
  revalidateChat(access.conversation.id);
  return ok(undefined, admin ? "Ist jetzt Admin der Gruppe." : "Ist kein Admin mehr.");
}

/** Gruppe verlassen bzw. 1:1-Unterhaltung aus der Liste entfernen (taucht bei neuer Nachricht wieder auf). */
export async function leaveConversationAction(conversationId: string): Promise<ActionResult> {
  const ctx = await chatCtx();
  if (!ctx) return fail("Keine Berechtigung.");
  const access = await getConversationAccess(ctx.user.id, String(conversationId), ctx.tenant.id);
  if (!access) return fail("Unterhaltung nicht gefunden.");
  if (isClubKey(access.conversation.directKey)) return fail("Die Vereins-Gruppe kann nicht verlassen werden. Du kannst sie aber stummschalten.");
  await db.chatMember.delete({ where: { id: access.member.id } });
  if (access.conversation.kind === "GROUP" && access.member.role === "ADMIN") await ensureGroupAdmin(access.conversation.id);
  publishChat({ type: "conversation", tenantId: ctx.tenant.id, conversationId: access.conversation.id });
  revalidateChat();
  return ok(undefined, access.conversation.kind === "GROUP" ? "Du hast die Gruppe verlassen." : "Unterhaltung entfernt.");
}

export async function setMutedAction(conversationId: string, muted: boolean): Promise<ActionResult> {
  const ctx = await chatCtx();
  if (!ctx) return fail("Keine Berechtigung.");
  const access = await getConversationAccess(ctx.user.id, String(conversationId), ctx.tenant.id);
  if (!access) return fail("Unterhaltung nicht gefunden.");
  await db.chatMember.update({ where: { id: access.member.id }, data: { muted: !!muted } });
  revalidateChat(access.conversation.id);
  return ok(undefined, muted ? "Stummgeschaltet." : "Stummschaltung aufgehoben.");
}

/** Vereins-Gruppe synchron halten (neue Vereinsmitglieder werden beim Öffnen des Chats aufgenommen). */
export async function setClubSyncAction(conversationId: string, sync: boolean): Promise<ActionResult> {
  const ctx = await chatCtx();
  if (!ctx || !ctx.can("tenant.manage")) return fail("Nur Vereins-Admins dürfen das.");
  const access = await groupAccess(ctx, conversationId, false);
  if (typeof access === "string") return fail(access);
  const id = access.conversation.id;
  if (sync) {
    try {
      await db.chatConversation.update({ where: { id }, data: { directKey: clubKeyFor(ctx.tenant.id) } });
    } catch (e) {
      if (isUniqueViolation(e)) return fail("Es gibt bereits eine synchronisierte Vereins-Gruppe.");
      throw e;
    }
    await syncAllClubMembers(id, ctx.tenant.id);
  } else {
    await db.chatConversation.update({ where: { id }, data: { directKey: null } });
  }
  publishChat({ type: "conversation", tenantId: ctx.tenant.id, conversationId: id });
  revalidateChat(id);
  return ok(undefined, sync ? "Alle Vereinsmitglieder sind jetzt in der Gruppe." : "Synchronisierung ausgeschaltet.");
}

/* ------------------------------------------------------------ Nachrichten */

export async function editMessageAction(messageId: string, body: string): Promise<ActionResult<ChatMessageDTO>> {
  const ctx = await chatCtx();
  if (!ctx) return fail("Keine Berechtigung.");
  const id = idSchema.safeParse(messageId);
  const text = messageBodySchema.safeParse(String(body ?? ""));
  if (!id.success) return fail("Nachricht nicht gefunden.");
  if (!text.success) return fail(text.error.issues[0]?.message ?? "Ungültige Nachricht.");
  const res = await editMessage(ctx.user.id, id.data, text.data, new Date());
  return res.ok ? ok(res.data) : fail(res.error);
}

export async function deleteMessageAction(messageId: string): Promise<ActionResult<ChatMessageDTO>> {
  const ctx = await chatCtx();
  if (!ctx) return fail("Keine Berechtigung.");
  const id = idSchema.safeParse(messageId);
  if (!id.success) return fail("Nachricht nicht gefunden.");
  const res = await deleteMessage(ctx.user.id, id.data, new Date());
  return res.ok ? ok(res.data, "Nachricht gelöscht.") : fail(res.error);
}
