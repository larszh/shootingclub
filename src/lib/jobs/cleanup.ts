import "server-only";
import { db } from "@/lib/db";
import { cleanupExpiredSessions } from "@/lib/auth";

const DAY = 86_400_000;

/**
 * Stündliches Aufräumen:
 * - abgelaufene Sessions
 * - abgelaufene oder benutzte AuthTokens älter als 7 Tage (Wiederherstellungscodes laufen nie ab
 *   und werden nur nach Benutzung entfernt)
 * - abgelaufene Einladungen älter als 30 Tage
 * - versandte/übersprungene Mails älter als 90 Tage
 */
export async function runCleanup(): Promise<Record<string, number>> {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY);
  const sessions = await cleanupExpiredSessions();
  const tokens = await db.authToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: weekAgo } },
        { usedAt: { not: null, lt: weekAgo } },
      ],
    },
  });
  const invitations = await db.invitation.deleteMany({
    where: { acceptedAt: null, expiresAt: { lt: new Date(now - 30 * DAY) } },
  });
  const mails = await db.mailMessage.deleteMany({
    where: { status: { in: ["SENT", "SKIPPED"] }, createdAt: { lt: new Date(now - 90 * DAY) } },
  });
  return { sessions, tokens: tokens.count, invitations: invitations.count, mails: mails.count };
}
