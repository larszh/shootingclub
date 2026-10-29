import "server-only";
import { db } from "@/lib/db";
import { MODULES } from "@/lib/modules";
import { userAvatarUrl } from "@/components/avatar";
import { deleteTenantFile } from "@/modules/files/service";
import { publishChat } from "./bus";
import { scheduleChatPush } from "@/lib/push/chat";
import {
  DELETED_LABEL,
  EDIT_WINDOW_MS,
  PAGE_SIZE,
  clubKeyFor,
  directParticipants,
  type ChatMessageDTO,
  type ChatReadDTO,
} from "./types";

/**
 * Kernlogik des Chats, gemeinsam genutzt von Server Actions und Route-Handlern.
 * Jede Funktion prüft Mitgliedschaft im Verein UND in der Unterhaltung.
 * Datenschutz: Nachrichteninhalte werden nie geloggt.
 */

export { DELETED_LABEL };

/* ------------------------------------------------------------ Zugriff */

/** Ist das Modul «chat» für den Verein aktiv? (ohne Request-Kontext, z.B. für API-Routen) */
export async function isChatEnabled(tenantId: string) {
  const row = await db.tenantModule.findUnique({ where: { tenantId_moduleKey: { tenantId, moduleKey: "chat" } } });
  if (row) return row.enabled;
  return MODULES.find((m) => (m.key as string) === "chat")?.defaultEnabled ?? false;
}

export async function isTenantMember(userId: string, tenantId: string) {
  // Ausgetretene (LEFT) und Vereine mit geplanter Löschung zählen nicht.
  const m = await db.membership.findUnique({ where: { userId_tenantId: { userId, tenantId } }, select: { status: true, tenant: { select: { deletedAt: true } } } });
  return !!m && m.status !== "LEFT" && !m.tenant.deletedAt;
}

export type ConversationAccess = {
  conversation: { id: string; tenantId: string; kind: string; title: string | null; directKey: string | null; createdById: string | null };
  member: { id: string; role: string; muted: boolean; lastReadAt: Date | null };
};

/**
 * Zugriff auf eine Unterhaltung: Benutzer ist Mitglied der Unterhaltung, (noch) Mitglied
 * des Vereins und das Modul ist aktiv. Optional muss die Unterhaltung zum erwarteten Verein gehören.
 */
export async function getConversationAccess(userId: string, conversationId: string, expectTenantId?: string): Promise<ConversationAccess | null> {
  if (!conversationId || conversationId.length > 64) return null;
  const member = await db.chatMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: {
      id: true,
      role: true,
      muted: true,
      lastReadAt: true,
      conversation: { select: { id: true, tenantId: true, kind: true, title: true, directKey: true, createdById: true } },
    },
  });
  if (!member) return null;
  const c = member.conversation;
  if (expectTenantId && c.tenantId !== expectTenantId) return null;
  if (!(await isTenantMember(userId, c.tenantId))) return null;
  if (!(await isChatEnabled(c.tenantId))) return null;
  return { conversation: c, member: { id: member.id, role: member.role, muted: member.muted, lastReadAt: member.lastReadAt } };
}

/**
 * Für die Dateiablage (/api/documents/<id>): darf der Benutzer eine Chat-Datei sehen?
 * true, wenn die Datei an einer Nachricht in einer Unterhaltung hängt, in der er Mitglied ist
 * (und er dem Verein noch angehört).
 */
export async function canAccessChatFile(userId: string, fileId: string) {
  const msg = await db.chatMessage.findFirst({
    where: { fileId, deletedAt: null, conversation: { members: { some: { userId } } } },
    select: { conversation: { select: { tenantId: true } } },
  });
  if (!msg) return false;
  return isTenantMember(userId, msg.conversation.tenantId);
}

/* ------------------------------------------------------------ Nachrichten */

export const messageSelect = {
  id: true,
  conversationId: true,
  clientId: true,
  senderId: true,
  body: true,
  createdAt: true,
  editedAt: true,
  deletedAt: true,
  sender: { select: { id: true, name: true, avatarPath: true, updatedAt: true } },
  file: { select: { id: true, name: true, mimeType: true, sizeBytes: true } },
} as const;

type MessageRow = {
  id: string;
  conversationId: string;
  clientId: string | null;
  senderId: string | null;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  sender: { id: string; name: string; avatarPath: string | null; updatedAt: Date } | null;
  file: { id: string; name: string; mimeType: string; sizeBytes: number } | null;
};

export function toMessageDTO(m: MessageRow): ChatMessageDTO {
  const deleted = !!m.deletedAt;
  return {
    id: m.id,
    conversationId: m.conversationId,
    clientId: m.clientId,
    senderId: m.senderId,
    senderName: m.sender?.name ?? "Ehemaliges Mitglied",
    senderAvatar: m.sender ? userAvatarUrl(m.sender) : null,
    body: deleted ? "" : m.body,
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt?.toISOString() ?? null,
    deletedAt: m.deletedAt?.toISOString() ?? null,
    file: deleted ? null : m.file,
  };
}

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

const failS = (error: string, status = 400): ServiceResult<never> => ({ ok: false, error, status });

/**
 * Nachricht idempotent anlegen: gleiche clientId → bestehende Nachricht zurückgeben,
 * nie doppelt speichern (auch wenn mehrere Tabs dieselbe Outbox senden).
 */
export async function createMessage(input: { userId: string; access: ConversationAccess; clientId: string; body: string; fileId?: string | null }): Promise<ServiceResult<{ message: ChatMessageDTO; created: boolean }>> {
  const { userId, access, clientId, body, fileId } = input;
  const conv = access.conversation;
  if (!body && !fileId) return failS("Die Nachricht ist leer.");

  const existing = await db.chatMessage.findUnique({ where: { clientId }, select: messageSelect });
  if (existing) {
    if (existing.senderId !== userId || existing.conversationId !== conv.id) return failS("Ungültige Nachrichten-ID.", 409);
    return { ok: true, data: { message: toMessageDTO(existing), created: false } };
  }

  let rejoined = false;
  // 1:1: Hat das Gegenüber die Unterhaltung entfernt, wird es wieder aufgenommen (sofern noch im Verein).
  if (conv.kind === "DIRECT") {
    const pair = directParticipants(conv.directKey);
    const other = pair?.find((id) => id !== userId);
    if (!other || !(await isTenantMember(other, conv.tenantId))) return failS("Diese Person ist nicht mehr im Verein.", 409);
    const present = await db.chatMember.findUnique({ where: { conversationId_userId: { conversationId: conv.id, userId: other } }, select: { id: true } });
    if (!present) {
      try {
        // Bisheriger Verlauf gilt als gelesen – sonst erschiene beim Wiederauftauchen alles als ungelesen.
        const last = await db.chatConversation.findUnique({ where: { id: conv.id }, select: { lastMessageAt: true } });
        await db.chatMember.create({ data: { conversationId: conv.id, userId: other, lastReadAt: last?.lastMessageAt ?? null } });
        rejoined = true;
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
      }
    }
  }

  let row: MessageRow;
  try {
    row = await db.chatMessage.create({
      data: { conversationId: conv.id, senderId: userId, body, fileId: fileId ?? null, clientId },
      select: messageSelect,
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const again = await db.chatMessage.findUnique({ where: { clientId }, select: messageSelect });
    if (!again || again.senderId !== userId || again.conversationId !== conv.id) return failS("Ungültige Nachrichten-ID.", 409);
    return { ok: true, data: { message: toMessageDTO(again), created: false } };
  }

  await db.$transaction([
    db.chatConversation.update({ where: { id: conv.id }, data: { lastMessageAt: row.createdAt } }),
    db.chatMember.update({ where: { id: access.member.id }, data: { lastReadAt: row.createdAt } }),
  ]);

  const dto = toMessageDTO(row);
  // Wieder aufgenommenes Gegenüber: Stream-Verbindungen sollen die Unterhaltung zuerst kennen.
  if (rejoined) publishChat({ type: "conversation", tenantId: conv.tenantId, conversationId: conv.id });
  publishChat({ type: "message", tenantId: conv.tenantId, conversationId: conv.id, message: dto });
  publishChat({ type: "read", tenantId: conv.tenantId, conversationId: conv.id, userId, lastReadAt: row.createdAt.toISOString() });
  // Push an Mitglieder, die die Nachricht nicht live sehen (verzögert, nie blockierend)
  scheduleChatPush({
    tenantId: conv.tenantId,
    conversationId: conv.id,
    kind: conv.kind,
    groupTitle: conv.title,
    messageId: row.id,
    senderId: userId,
    senderName: dto.senderName,
    body,
    hasFile: !!fileId,
    createdAt: row.createdAt,
  });
  return { ok: true, data: { message: dto, created: true } };
}

async function loadOwnOrAdminMessage(userId: string, messageId: string) {
  const msg = await db.chatMessage.findUnique({ where: { id: messageId }, select: { id: true, conversationId: true, senderId: true, createdAt: true, deletedAt: true, fileId: true } });
  if (!msg) return null;
  const access = await getConversationAccess(userId, msg.conversationId);
  if (!access) return null;
  return { msg, access };
}

export async function editMessage(userId: string, messageId: string, body: string, now: Date): Promise<ServiceResult<ChatMessageDTO>> {
  const found = await loadOwnOrAdminMessage(userId, messageId);
  if (!found) return failS("Nachricht nicht gefunden.", 404);
  const { msg, access } = found;
  if (msg.senderId !== userId) return failS("Du kannst nur eigene Nachrichten bearbeiten.", 403);
  if (msg.deletedAt) return failS("Die Nachricht wurde gelöscht.");
  if (now.getTime() - msg.createdAt.getTime() > EDIT_WINDOW_MS) return failS("Nachrichten können nur 15 Minuten lang bearbeitet werden.");
  if (!body) return failS("Die Nachricht ist leer.");
  const row = await db.chatMessage.update({ where: { id: msg.id }, data: { body, editedAt: now }, select: messageSelect });
  const dto = toMessageDTO(row);
  publishChat({ type: "message", tenantId: access.conversation.tenantId, conversationId: msg.conversationId, message: dto });
  return { ok: true, data: dto };
}

export async function deleteMessage(userId: string, messageId: string, now: Date): Promise<ServiceResult<ChatMessageDTO>> {
  const found = await loadOwnOrAdminMessage(userId, messageId);
  if (!found) return failS("Nachricht nicht gefunden.", 404);
  const { msg, access } = found;
  if (msg.deletedAt) return failS("Die Nachricht ist bereits gelöscht.");
  const own = msg.senderId === userId;
  const groupAdmin = access.conversation.kind === "GROUP" && access.member.role === "ADMIN";
  if (!own && !groupAdmin) return failS("Du kannst nur eigene Nachrichten löschen.", 403);
  if (own && !groupAdmin && now.getTime() - msg.createdAt.getTime() > EDIT_WINDOW_MS) return failS("Nachrichten können nur 15 Minuten lang gelöscht werden.");
  // Inhalt wirklich entfernen (Datenschutz), Anhang lösen.
  const row = await db.chatMessage.update({ where: { id: msg.id }, data: { deletedAt: now, body: "", fileId: null }, select: messageSelect });
  if (msg.fileId) {
    // Anhang ebenfalls entfernen, sofern keine andere Nachricht darauf verweist.
    const stillUsed = await db.chatMessage.count({ where: { fileId: msg.fileId } });
    if (stillUsed === 0) await deleteTenantFile(msg.fileId, access.conversation.tenantId).catch(() => undefined);
  }
  const dto = toMessageDTO(row);
  publishChat({ type: "message", tenantId: access.conversation.tenantId, conversationId: msg.conversationId, message: dto });
  return { ok: true, data: dto };
}

export async function markRead(userId: string, access: ConversationAccess, now: Date) {
  // Nur vorwärts: nie einen späteren Lesestand überschreiben.
  if (access.member.lastReadAt && access.member.lastReadAt >= now) return access.member.lastReadAt;
  await db.chatMember.update({ where: { id: access.member.id }, data: { lastReadAt: now } });
  publishChat({ type: "read", tenantId: access.conversation.tenantId, conversationId: access.conversation.id, userId, lastReadAt: now.toISOString() });
  return now;
}

/** Neueste Nachrichten (aufsteigend sortiert) bzw. ältere vor einer Nachricht. */
export async function listMessagesPage(conversationId: string, beforeId?: string | null, limit = PAGE_SIZE) {
  if (beforeId) {
    const ok = await db.chatMessage.findFirst({ where: { id: beforeId, conversationId }, select: { id: true } });
    if (!ok) return { messages: [] as ChatMessageDTO[], hasMore: false };
  }
  const rows = await db.chatMessage.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(beforeId ? { cursor: { id: beforeId }, skip: 1 } : {}),
    select: messageSelect,
  });
  const hasMore = rows.length > limit;
  return { messages: rows.slice(0, limit).reverse().map(toMessageDTO), hasMore };
}

/** Überlappung beim Polling, damit knapp gleichzeitig gespeicherte Nachrichten nicht verloren gehen. */
export const POLL_OVERLAP_MS = 3000;

/** Neue, bearbeitete oder gelöschte Nachrichten seit `since` (für Polling und Stream-Fallback). */
export async function listChangedMessages(conversationIds: string[], since: Date, limit = 200) {
  if (!conversationIds.length) return [];
  const rows = await db.chatMessage.findMany({
    where: {
      conversationId: { in: conversationIds },
      OR: [{ createdAt: { gt: since } }, { editedAt: { gt: since } }, { deletedAt: { gt: since } }],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: messageSelect,
  });
  return rows.map(toMessageDTO);
}

export async function listReads(conversationId: string): Promise<ChatReadDTO[]> {
  const rows = await db.chatMember.findMany({ where: { conversationId, lastReadAt: { not: null } }, select: { userId: true, lastReadAt: true } });
  return rows.map((r) => ({ userId: r.userId, lastReadAt: r.lastReadAt!.toISOString() }));
}

/* ------------------------------------------------------------ Ungelesen */

/**
 * Anzahl ungelesener Nachrichten pro Unterhaltung (fremde, nicht gelöschte Nachrichten
 * nach lastReadAt). Eine Abfrage pro Unterhaltung – für Vereinsgrössen völlig ausreichend.
 */
export async function unreadCounts(userId: string, members: Array<{ conversationId: string; lastReadAt: Date | null }>) {
  const map = new Map<string, number>();
  await Promise.all(
    members.map(async (m) => {
      const n = await db.chatMessage.count({
        where: {
          conversationId: m.conversationId,
          deletedAt: null,
          OR: [{ senderId: null }, { senderId: { not: userId } }],
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        },
      });
      map.set(m.conversationId, n);
    }),
  );
  return map;
}

/** Summe ungelesener Nachrichten im Verein (stummgeschaltete Unterhaltungen zählen nicht). */
export async function totalUnread(userId: string, tenantId: string) {
  if (!(await isTenantMember(userId, tenantId))) return 0;
  const members = await db.chatMember.findMany({
    where: { userId, muted: false, conversation: { tenantId } },
    select: { conversationId: true, lastReadAt: true },
  });
  if (!members.length) return 0;
  return db.chatMessage.count({
    where: {
      deletedAt: null,
      AND: [
        { OR: [{ senderId: null }, { senderId: { not: userId } }] },
        { OR: members.map((m) => (m.lastReadAt ? { conversationId: m.conversationId, createdAt: { gt: m.lastReadAt } } : { conversationId: m.conversationId })) },
      ],
    },
  });
}

/* ------------------------------------------------------------ Vereins-Gruppe */

/**
 * Günstiger Abgleich beim Öffnen des Chats: Gibt es eine synchronisierte Vereins-Gruppe,
 * wird der aktuelle Benutzer aufgenommen, falls er (z.B. als neues Mitglied) noch fehlt.
 * Eine Abfrage im Normalfall.
 */
export async function syncClubGroupForUser(userId: string, tenantId: string) {
  const conv = await db.chatConversation.findUnique({
    where: { directKey: clubKeyFor(tenantId) },
    select: { id: true, tenantId: true, members: { where: { userId }, select: { id: true } } },
  });
  if (!conv || conv.tenantId !== tenantId || conv.members.length > 0) return false;
  try {
    await db.chatMember.create({ data: { conversationId: conv.id, userId } });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    return false;
  }
  publishChat({ type: "conversation", tenantId, conversationId: conv.id });
  return true;
}

/** Vollständiger Abgleich: alle Vereinsmitglieder in die Gruppe aufnehmen. */
export async function syncAllClubMembers(conversationId: string, tenantId: string) {
  const memberships = await db.membership.findMany({ where: { tenantId, status: { not: "LEFT" } }, select: { userId: true } });
  if (!memberships.length) return 0;
  const res = await db.chatMember.createMany({
    data: memberships.map((m) => ({ conversationId, userId: m.userId })),
    skipDuplicates: true,
  });
  if (res.count > 0) publishChat({ type: "conversation", tenantId, conversationId });
  return res.count;
}

/* ------------------------------------------------------------ Austritt aus dem Verein */

/**
 * Entfernt einen Benutzer aus allen Unterhaltungen eines Vereins (z.B. wenn er den Verein
 * verlässt oder entfernt wird). Gruppen ohne Admin erhalten das am längsten dabei
 * Mitglied als neuen Admin. Nachrichten bleiben erhalten (Absender bleibt sichtbar).
 * Zusätzlich prüft jeder Lesezugriff die Vereinsmitgliedschaft, damit auch ohne diesen
 * Aufruf nichts mehr sichtbar ist.
 */
export async function removeUserFromTenantChats(userId: string, tenantId: string) {
  const memberships = await db.chatMember.findMany({
    where: { userId, conversation: { tenantId } },
    select: { id: true, conversationId: true, role: true, conversation: { select: { kind: true } } },
  });
  if (!memberships.length) return 0;
  await db.chatMember.deleteMany({ where: { id: { in: memberships.map((m) => m.id) } } });
  for (const m of memberships) {
    if (m.conversation.kind === "GROUP" && m.role === "ADMIN") await ensureGroupAdmin(m.conversationId);
    publishChat({ type: "conversation", tenantId, conversationId: m.conversationId });
  }
  return memberships.length;
}

/** Hat eine Gruppe keinen Admin mehr, wird das älteste Mitglied Admin. Leere Gruppen bleiben bestehen. */
export async function ensureGroupAdmin(conversationId: string) {
  const admins = await db.chatMember.count({ where: { conversationId, role: "ADMIN" } });
  if (admins > 0) return;
  const oldest = await db.chatMember.findFirst({ where: { conversationId }, orderBy: { joinedAt: "asc" }, select: { id: true } });
  if (oldest) await db.chatMember.update({ where: { id: oldest.id }, data: { role: "ADMIN" } });
}
