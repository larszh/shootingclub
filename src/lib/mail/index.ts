import "server-only";
import { db } from "@/lib/db";
import { cleanHeader } from "./render";

export { renderMail, escapeHtml, type RenderMailInput } from "./render";
export { smtpConfigured } from "./transport";
export { sendDueMails } from "./sender";

/** Absolute URL zur App (APP_URL aus der Umgebung, z.B. https://standchef.ch). */
export function appUrl(path = "/"): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return base + (path.startsWith("/") ? path : `/${path}`);
}

export type EnqueueMailInput = {
  tenantId?: string | null;
  /** reset | invite | set-password | fee-invoice | reminder | booking | shift | test … */
  kind: string;
  to: string;
  toName?: string | null;
  subject: string;
  text: string;
  html?: string;
  /** Ohne Angabe: replyToEmail des Vereins (falls gesetzt). */
  replyTo?: string | null;
  /** Gleicher Schlüssel → keine zweite Mail (z.B. Erinnerungen). */
  dedupeKey?: string;
  sendAfter?: Date;
};

function isDuplicateError(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";
}

/**
 * Legt eine Mail in die Warteschlange (MailMessage, Status QUEUED).
 * Versendet wird sie vom Hintergrundjob «mail.send» (alle 30 s).
 * Rückgabe null, wenn dedupeKey bereits existiert oder die Adresse ein Platzhalter (.invalid) ist.
 */
export async function enqueueMail(m: EnqueueMailInput): Promise<{ id: string } | null> {
  const to = cleanHeader(m.to).toLowerCase();
  if (!to || !to.includes("@")) throw new Error("Ungültige Empfängeradresse");
  // Platzhalter-Adressen (z.B. importierte Mitglieder ohne E-Mail: …@standchef.invalid) nie verschicken.
  // Die TLD .invalid ist reserviert (RFC 2606) und kann nie zugestellt werden.
  if (to.endsWith(".invalid")) return null;
  let replyTo = m.replyTo ?? null;
  if (replyTo === null && m.replyTo === undefined && m.tenantId) {
    const t = await db.tenant.findUnique({ where: { id: m.tenantId }, select: { replyToEmail: true } });
    replyTo = t?.replyToEmail ?? null;
  }
  if (m.dedupeKey) {
    const existing = await db.mailMessage.findUnique({ where: { dedupeKey: m.dedupeKey }, select: { id: true } });
    if (existing) return null;
  }
  try {
    const row = await db.mailMessage.create({
      data: {
        tenantId: m.tenantId ?? null,
        kind: cleanHeader(m.kind, 60),
        toEmail: to,
        toName: m.toName ? cleanHeader(m.toName) : null,
        replyTo: replyTo ? cleanHeader(replyTo) : null,
        subject: cleanHeader(m.subject),
        text: m.text,
        html: m.html ?? "",
        dedupeKey: m.dedupeKey ? m.dedupeKey.slice(0, 191) : null,
        sendAfter: m.sendAfter ?? new Date(),
      },
      select: { id: true },
    });
    return row;
  } catch (err) {
    if (isDuplicateError(err)) return null;
    throw err;
  }
}
