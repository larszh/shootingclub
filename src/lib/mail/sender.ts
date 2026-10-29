import "server-only";
import { db } from "@/lib/db";
import { getTransport, mailFrom, safeErrorMessage } from "./transport";
import { cleanHeader, retryDelayMs } from "./render";

const BATCH = 20;
const MAX_PER_RUN = 200;
const MAX_ATTEMPTS = 5;
/** Zeilen, die länger als so lange im Status SENDING hängen (Absturz während Versand), werden neu eingereiht. */
const STALE_SENDING_MS = 10 * 60_000;

function formatAddress(email: string, name: string | null) {
  if (!name) return email;
  const n = cleanHeader(name).replace(/["\\]/g, "");
  return { name: n, address: email };
}

/**
 * Versendet fällige Mails aus der Warteschlange. Wird vom Job «mail.send» aufgerufen.
 * Rückgabe: Anzahl verarbeiteter Mails.
 */
export async function sendDueMails(): Promise<number> {
  const transport = getTransport();
  const isDev = process.env.NODE_ENV !== "production";

  // Hängengebliebene SENDING-Zeilen zurücksetzen. Kein Fortschrittsfeld vorhanden,
  // deshalb dient sendAfter (beim Claim auf «jetzt» gesetzt) als Zeitstempel.
  await db.mailMessage.updateMany({
    where: { status: "SENDING", sendAfter: { lt: new Date(Date.now() - STALE_SENDING_MS) } },
    data: { status: "QUEUED" },
  });

  let processed = 0;
  while (processed < MAX_PER_RUN) {
    const due = await db.mailMessage.findMany({
      where: { status: "QUEUED", sendAfter: { lte: new Date() } },
      orderBy: { sendAfter: "asc" },
      take: BATCH,
      select: { id: true },
    });
    if (!due.length) break;

    for (const { id } of due) {
      if (processed >= MAX_PER_RUN) break;
      // Atomar beanspruchen: nur wer QUEUED → SENDING umstellt, versendet.
      const claimed = await db.mailMessage.updateMany({
        where: { id, status: "QUEUED" },
        data: { status: "SENDING", sendAfter: new Date() },
      });
      if (claimed.count !== 1) continue;
      processed++;
      const m = await db.mailMessage.findUnique({ where: { id } });
      if (!m) continue;

      if (!transport) {
        if (isDev) console.info(`[mail] SMTP nicht konfiguriert, übersprungen: «${m.subject}» an ${m.toEmail}`);
        await db.mailMessage.update({ where: { id }, data: { status: "SKIPPED", lastError: "SMTP nicht konfiguriert" } });
        continue;
      }

      try {
        await transport.sendMail({
          from: mailFrom(),
          to: formatAddress(m.toEmail, m.toName),
          replyTo: m.replyTo ? cleanHeader(m.replyTo) : undefined,
          subject: cleanHeader(m.subject, 250),
          text: m.text,
          html: m.html || undefined,
          headers: { "X-Standchef-Kind": cleanHeader(m.kind ?? "mail", 60) },
        });
        await db.mailMessage.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), attempts: m.attempts + 1, lastError: null } });
      } catch (err) {
        const attempts = m.attempts + 1;
        const lastError = safeErrorMessage(err);
        if (attempts < MAX_ATTEMPTS) {
          await db.mailMessage.update({
            where: { id },
            data: { status: "QUEUED", attempts, lastError, sendAfter: new Date(Date.now() + retryDelayMs(attempts)) },
          });
        } else {
          await db.mailMessage.update({ where: { id }, data: { status: "FAILED", attempts, lastError } });
        }
        console.warn(`[mail] Versand fehlgeschlagen (Versuch ${attempts}/${MAX_ATTEMPTS}): ${lastError}`);
      }
    }
  }
  return processed;
}
