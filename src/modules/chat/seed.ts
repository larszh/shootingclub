/**
 * Demo-Chat für den Seed (prisma/seed.ts). Bewusst nur relative Imports und kein
 * "server-only", damit tsx das Skript ausserhalb von Next.js ausführen kann.
 * Idempotent: bestehende Unterhaltungen werden nicht nochmals angelegt.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { directKeyFor } from "./types";

type Db = Pick<PrismaClient, "chatConversation" | "chatMember" | "chatMessage">;

const MINUTE = 60_000;

/**
 * Legt eine Gruppe «Vorstand» (alle übergebenen Benutzer, der erste ist Admin) und eine
 * 1:1-Unterhaltung zwischen den ersten beiden Benutzern an, jeweils mit ein paar Nachrichten.
 */
export async function seedDemoChat(db: Db, tenantId: string, userIds: string[]) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length < 2) return { created: 0, skipped: true };
  const [a, b] = [ids[0]!, ids[1]!];
  const now = Date.now();
  let created = 0;

  // Gruppe «Vorstand»
  const existingGroup = await db.chatConversation.findFirst({ where: { tenantId, kind: "GROUP", title: "Vorstand" }, select: { id: true } });
  if (!existingGroup) {
    const texts: Array<[string, string, number]> = [
      [a, "Grüezi miteinand! Hier besprechen wir ab sofort die Vorstandsthemen.", 26 * 60],
      [b, "Super, danke. Wann ist die nächste Sitzung?", 25 * 60],
      [a, "Dienstag, 19:30 im Schützenhaus. Traktanden folgen.", 25 * 60 - 10],
      [ids[2] ?? b, "Ich bringe die Abrechnung vom Obligatorischen mit.", 3 * 60],
      [a, "Merci! Bitte auch an die Munitionsbestellung denken.", 2 * 60],
    ];
    const lastAt = new Date(now - texts[texts.length - 1]![2] * MINUTE);
    const group = await db.chatConversation.create({
      data: {
        tenantId,
        kind: "GROUP",
        title: "Vorstand",
        createdById: a,
        lastMessageAt: lastAt,
        createdAt: new Date(now - 27 * 60 * MINUTE),
        members: { create: ids.map((userId, i) => ({ userId, role: i === 0 ? "ADMIN" : "MEMBER", joinedAt: new Date(now - 27 * 60 * MINUTE), lastReadAt: i === 0 ? lastAt : null })) },
      },
      select: { id: true },
    });
    await db.chatMessage.createMany({
      data: texts.map(([senderId, body, minutesAgo], i) => ({
        conversationId: group.id,
        senderId,
        body,
        clientId: `seed-${group.id}-${i}`,
        createdAt: new Date(now - minutesAgo * MINUTE),
      })),
    });
    created++;
  }

  // 1:1 zwischen den ersten beiden Benutzern
  const directKey = directKeyFor(tenantId, a, b);
  const existingDirect = await db.chatConversation.findUnique({ where: { directKey }, select: { id: true } });
  if (!existingDirect) {
    const texts: Array<[string, string, number]> = [
      [b, "Hoi! Hast du am Samstag Zeit fürs Training?", 50],
      [a, "Ja, ich bin ab 9 Uhr am Stand.", 45],
      [b, "Perfekt, bis dann 👍", 44],
    ];
    const lastAt = new Date(now - texts[texts.length - 1]![2] * MINUTE);
    const direct = await db.chatConversation.create({
      data: {
        tenantId,
        kind: "DIRECT",
        directKey,
        createdById: b,
        lastMessageAt: lastAt,
        createdAt: new Date(now - 60 * MINUTE),
        members: { create: [{ userId: a, lastReadAt: new Date(now - 45 * MINUTE) }, { userId: b, lastReadAt: lastAt }] },
      },
      select: { id: true },
    });
    await db.chatMessage.createMany({
      data: texts.map(([senderId, body, minutesAgo], i) => ({
        conversationId: direct.id,
        senderId,
        body,
        clientId: `seed-${direct.id}-${i}`,
        createdAt: new Date(now - minutesAgo * MINUTE),
      })),
    });
    created++;
  }

  return { created, skipped: created === 0 };
}
