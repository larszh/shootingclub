import "server-only";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { isOnline } from "./presence";
import { truncateText } from "./endpoint";

/**
 * Nach dieser Wartezeit erhalten nur noch Mitglieder einen Push, die die Nachricht nicht
 * gelesen haben und nicht live verbunden sind (offener Chat markiert sofort als gelesen).
 */
const CHAT_PUSH_DELAY_MS = 10_000;
/** Höchstens eine Chat-E-Mail pro Unterhaltung und Empfänger in diesem Zeitfenster. */
const CHAT_EMAIL_WINDOW_MS = 6 * 60 * 60_000;

export type ChatPushInput = {
  tenantId: string;
  conversationId: string;
  kind: string; // DIRECT | GROUP
  groupTitle: string | null;
  messageId: string;
  senderId: string;
  senderName: string;
  body: string;
  hasFile: boolean;
  createdAt: Date;
};

async function deliver(m: ChatPushInput) {
  const msg = await db.chatMessage.findUnique({ where: { id: m.messageId }, select: { deletedAt: true } });
  if (!msg || msg.deletedAt) return;
  const members = await db.chatMember.findMany({
    where: { conversationId: m.conversationId, muted: false, NOT: { userId: m.senderId } },
    select: { userId: true, lastReadAt: true },
  });
  const targets = members
    .filter((x) => !x.lastReadAt || x.lastReadAt < m.createdAt)
    .map((x) => x.userId)
    .filter((id) => !isOnline(id));
  if (!targets.length) return;

  const isGroup = m.kind === "GROUP" && !!m.groupTitle;
  const text = truncateText(m.body, 80);
  const titleKey = isGroup ? "notify.chat.titleGroup" : "notify.chat.title";
  const vars = { sender: m.senderName, group: m.groupTitle ?? "", club: "" };
  const tenant = await db.tenant.findUnique({ where: { id: m.tenantId }, select: { name: true } });
  vars.club = tenant?.name ?? "Standchef";
  const bucket = Math.floor(m.createdAt.getTime() / CHAT_EMAIL_WINDOW_MS);

  await notify({
    tenantId: m.tenantId,
    userIds: targets,
    topic: "chat",
    title: isGroup ? `${m.senderName} in «${m.groupTitle}»` : m.senderName,
    body: text || "",
    url: `/chat/${m.conversationId}`,
    tag: `chat:${m.conversationId}`,
    urgency: "high",
    i18n: {
      title: titleKey,
      // Nur Dateianhang: übersetzter Hinweis; sonst die ersten 80 Zeichen der Nachricht
      body: text ? "notify.chat.body" : "notify.chat.attachment",
      emailSubject: "notify.chat.emailSubject",
      // Datenschutz: kein Nachrichteninhalt in E-Mails
      emailBody: "notify.chat.emailBody",
      vars: { ...vars, text },
    },
    dedupeKey: `chat:${m.conversationId}:${bucket}`,
  });
}

/**
 * Plant den Push für eine neue Chat-Nachricht (läuft im Hintergrund des langlebigen
 * Node-Prozesses; blockiert das Senden nie).
 */
export function scheduleChatPush(m: ChatPushInput): void {
  try {
    const timer = setTimeout(() => {
      void deliver(m).catch((e) => console.error("Chat-Push fehlgeschlagen:", (e as Error).message));
    }, CHAT_PUSH_DELAY_MS);
    timer.unref?.();
  } catch {
    // Benachrichtigungen dürfen das Senden nie verhindern.
  }
}
