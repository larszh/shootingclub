import "server-only";
import { db } from "@/lib/db";
import { userAvatarUrl } from "@/components/avatar";
import {
  POLL_OVERLAP_MS,
  getConversationAccess,
  listMessagesPage,
  listReads,
  totalUnread,
  unreadCounts,
} from "./service";
import { directParticipants, isClubKey, type ChatMemberDTO, type ChatMessageDTO, type ChatReadDTO, type ChatRole } from "./types";

/**
 * Anzahl ungelesener Chat-Nachrichten im Verein (für das Badge in der Navigation).
 * Stummgeschaltete Unterhaltungen zählen nicht. 0, wenn der Benutzer nicht (mehr) Mitglied ist.
 */
export async function getUnreadChatCount(userId: string, tenantId: string): Promise<number> {
  try {
    return await totalUnread(userId, tenantId);
  } catch {
    return 0;
  }
}

export type ConversationListItem = {
  id: string;
  kind: "DIRECT" | "GROUP";
  title: string;
  avatarUrl: string | null;
  /** Für Initialen im Avatar */
  avatarName: string;
  isClub: boolean;
  memberCount: number;
  muted: boolean;
  unread: number;
  lastMessageAt: string | null;
  preview: { text: string; senderName: string | null; mine: boolean; deleted: boolean; hasFile: boolean } | null;
};

/** Unterhaltungen des Benutzers im Verein, neueste zuerst. */
export async function listConversations(userId: string, tenantId: string): Promise<ConversationListItem[]> {
  const memberships = await db.chatMember.findMany({
    where: { userId, conversation: { tenantId } },
    select: {
      muted: true,
      lastReadAt: true,
      conversationId: true,
      conversation: { select: { id: true, kind: true, title: true, directKey: true, lastMessageAt: true, createdAt: true, _count: { select: { members: true } } } },
    },
  });
  if (!memberships.length) return [];

  // Gegenüber in 1:1-Unterhaltungen in einer Abfrage laden.
  const otherIds = new Set<string>();
  for (const m of memberships) {
    if (m.conversation.kind !== "DIRECT") continue;
    const pair = directParticipants(m.conversation.directKey);
    const other = pair?.find((id) => id !== userId);
    if (other) otherIds.add(other);
  }
  const others = otherIds.size
    ? await db.user.findMany({ where: { id: { in: [...otherIds] } }, select: { id: true, name: true, avatarPath: true, updatedAt: true } })
    : [];
  const otherById = new Map(others.map((u) => [u.id, u]));

  const [counts, lasts] = await Promise.all([
    unreadCounts(userId, memberships.map((m) => ({ conversationId: m.conversationId, lastReadAt: m.lastReadAt }))),
    Promise.all(
      memberships.map((m) =>
        db.chatMessage.findFirst({
          where: { conversationId: m.conversationId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { body: true, deletedAt: true, fileId: true, senderId: true, sender: { select: { name: true } }, file: { select: { name: true } } },
        }),
      ),
    ),
  ]);

  const items = memberships.map((m, i): ConversationListItem => {
    const c = m.conversation;
    const last = lasts[i];
    let title = c.title ?? "Gruppe";
    let avatarUrl: string | null = null;
    if (c.kind === "DIRECT") {
      const other = otherById.get(directParticipants(c.directKey)?.find((id) => id !== userId) ?? "");
      title = other?.name ?? "Ehemaliges Mitglied";
      avatarUrl = other ? userAvatarUrl(other) : null;
    }
    const deleted = !!last?.deletedAt;
    return {
      id: c.id,
      kind: c.kind === "DIRECT" ? "DIRECT" : "GROUP",
      title,
      avatarUrl,
      avatarName: title,
      isClub: isClubKey(c.directKey),
      memberCount: c._count.members,
      muted: m.muted,
      unread: counts.get(c.id) ?? 0,
      lastMessageAt: (c.lastMessageAt ?? c.createdAt).toISOString(),
      preview: last
        ? {
            text: deleted ? "" : last.body ? last.body.slice(0, 140) : last.file ? last.file.name : "",
            senderName: last.sender?.name ?? null,
            mine: last.senderId === userId,
            deleted,
            hasFile: !deleted && !!last.fileId,
          }
        : null,
    };
  });
  items.sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
  return items;
}

export type PickerMember = { id: string; name: string; avatarUrl: string | null };

/** Mitglieder des Vereins für die Auswahl (ohne den Benutzer selbst). */
export async function listTenantMembersForPicker(tenantId: string, excludeUserId?: string): Promise<PickerMember[]> {
  const rows = await db.membership.findMany({
    where: { tenantId, ...(excludeUserId ? { userId: { not: excludeUserId } } : {}) },
    select: { user: { select: { id: true, name: true, avatarPath: true, updatedAt: true } } },
  });
  return rows
    .map((r) => ({ id: r.user.id, name: r.user.name, avatarUrl: userAvatarUrl(r.user) }))
    .sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
}

export type ConversationDetail = {
  id: string;
  kind: "DIRECT" | "GROUP";
  title: string;
  /** Gruppenname ohne Rückfall (zum Umbenennen) */
  rawTitle: string | null;
  avatarUrl: string | null;
  isClub: boolean;
  myRole: ChatRole;
  muted: boolean;
  /** Lesestand beim Öffnen (für die Markierung «Neue Nachrichten») */
  lastReadAt: string | null;
  members: ChatMemberDTO[];
  /** 1:1: Gegenüber ist nicht mehr im Verein */
  otherLeft: boolean;
  messages: ChatMessageDTO[];
  hasMore: boolean;
  reads: ChatReadDTO[];
  /** Start-Cursor für ?after= (Polling-Rückfall) */
  cursor: string;
};

/** Unterhaltung mit Mitgliedern und der neuesten Nachrichtenseite. null = kein Zugriff. */
export async function getConversationDetail(userId: string, tenantId: string, conversationId: string): Promise<ConversationDetail | null> {
  const access = await getConversationAccess(userId, conversationId, tenantId);
  if (!access) return null;
  const c = access.conversation;
  const cursor = new Date(Date.now() - POLL_OVERLAP_MS).toISOString();

  const [memberRows, tenantMemberIds, page, reads] = await Promise.all([
    db.chatMember.findMany({
      where: { conversationId: c.id },
      select: { userId: true, role: true, lastReadAt: true, joinedAt: true, user: { select: { id: true, name: true, avatarPath: true, updatedAt: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    db.membership.findMany({ where: { tenantId }, select: { userId: true } }),
    listMessagesPage(c.id),
    listReads(c.id),
  ]);
  const inTenant = new Set(tenantMemberIds.map((m) => m.userId));
  // Ehemalige Vereinsmitglieder nicht mehr als Mitglieder anzeigen.
  const members: ChatMemberDTO[] = memberRows
    .filter((m) => inTenant.has(m.userId))
    .map((m): ChatMemberDTO => ({
      userId: m.userId,
      name: m.user.name,
      avatarUrl: userAvatarUrl(m.user),
      role: m.role === "ADMIN" ? "ADMIN" : "MEMBER",
      lastReadAt: m.lastReadAt?.toISOString() ?? null,
    }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, "de-CH") : a.role === "ADMIN" ? -1 : 1));

  let title = c.title ?? "Gruppe";
  let avatarUrl: string | null = null;
  let otherLeft = false;
  if (c.kind === "DIRECT") {
    const otherId = directParticipants(c.directKey)?.find((id) => id !== userId) ?? "";
    const other = otherId ? await db.user.findUnique({ where: { id: otherId }, select: { id: true, name: true, avatarPath: true, updatedAt: true } }) : null;
    title = other?.name ?? "Ehemaliges Mitglied";
    avatarUrl = other ? userAvatarUrl(other) : null;
    otherLeft = !other || !inTenant.has(other.id);
  }

  return {
    id: c.id,
    kind: c.kind === "DIRECT" ? "DIRECT" : "GROUP",
    title,
    rawTitle: c.title,
    avatarUrl,
    isClub: isClubKey(c.directKey),
    myRole: access.member.role === "ADMIN" ? "ADMIN" : "MEMBER",
    muted: access.member.muted,
    lastReadAt: access.member.lastReadAt?.toISOString() ?? null,
    members,
    otherLeft,
    messages: page.messages,
    hasMore: page.hasMore,
    reads: reads.filter((r) => inTenant.has(r.userId)),
    cursor,
  };
}

/** Gibt es bereits eine synchronisierte Vereins-Gruppe? */
export async function getClubGroupId(tenantId: string) {
  const c = await db.chatConversation.findUnique({ where: { directKey: `${tenantId}:club` }, select: { id: true, tenantId: true } });
  return c && c.tenantId === tenantId ? c.id : null;
}
