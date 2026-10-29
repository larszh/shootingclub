import "server-only";
import { db } from "@/lib/db";
import { appUrl, enqueueMail, renderMail } from "@/lib/mail";
import { INTL_LOCALE, getT, normalizeLocale, type Locale } from "@/lib/i18n";
import { sendPush, truncateText } from "@/lib/push";
import { resolvePreference, type NotifyTopic, type PreferenceRow } from "@/lib/push/topics";

export type { NotifyTopic } from "@/lib/push/topics";

export type NotifyInput = {
  tenantId: string | null;
  userIds: string[];
  topic: NotifyTopic;
  /** Fertiger Text (Deutsch oder Vereinssprache). Wird durch `i18n` pro Empfänger ersetzt. */
  title: string;
  body: string;
  /** Relativer Pfad in der App, z.B. /payments */
  url?: string;
  /** false = nie per E-Mail. Sonst gilt die Einstellung des Empfängers (Standard je Thema). */
  email?: boolean;
  emailSubject?: string;
  // --- optionale Erweiterungen ---
  /** Übersetzungsschlüssel: Texte werden pro Empfänger in seiner Sprache aufgebaut. */
  i18n?: {
    title: string;
    /** ohne Angabe: `body` unverändert (z.B. Text einer Mitteilung) */
    body?: string;
    emailSubject?: string;
    emailBody?: string;
    vars?: Record<string, string | number>;
    /** Sprachabhängige Platzhalter (Datum, Betrag) – überschreiben gleichnamige `vars`. */
    localeVars?: (locale: Locale) => Record<string, string | number>;
  };
  /** Abweichender E-Mail-Text (z.B. Chat: ohne Nachrichteninhalt). */
  emailBody?: string;
  /** Gruppierung auf dem Gerät, z.B. chat:<conversationId> */
  tag?: string;
  urgency?: "very-low" | "low" | "normal" | "high";
  /** Gleicher Schlüssel → keine zweite E-Mail an denselben Empfänger. */
  dedupeKey?: string;
  /** false = kein Push (nur E-Mail). */
  push?: boolean;
};

type Recipient = { id: string; email: string; name: string; locale: Locale };

/** Mail-Art in der Warteschlange (MailMessage.kind) je Thema. */
const MAIL_KIND: Record<NotifyTopic, string> = {
  chat: "notify-chat",
  announcements: "notify-announcement",
  events: "notify-event",
  bookings: "booking",
  invoices: "fee-invoice",
  shifts: "shift",
  reminders: "reminder",
  system: "notify-system",
};

async function loadRecipients(tenantId: string | null, userIds: string[]): Promise<Recipient[]> {
  const ids = [...new Set(userIds)].filter((id) => typeof id === "string" && id.length > 0 && id.length <= 64);
  if (!ids.length) return [];
  const users = await db.user.findMany({
    where: {
      id: { in: ids },
      deletedAt: null,
      // Nur aktuelle Mitglieder des Vereins (ausgetretene erhalten nichts mehr)
      ...(tenantId ? { memberships: { some: { tenantId, status: { not: "LEFT" } } } } : {}),
    },
    select: { id: true, email: true, name: true, locale: true },
  });
  return users.map((u) => ({ id: u.id, email: u.email, name: u.name, locale: normalizeLocale(u.locale) }));
}

function textsFor(n: NotifyInput, locale: Locale) {
  if (!n.i18n) return { title: n.title, body: n.body, subject: n.emailSubject ?? n.title, emailBody: n.emailBody ?? n.body };
  const t = getT(locale);
  const vars = n.i18n.localeVars ? { ...n.i18n.vars, ...n.i18n.localeVars(locale) } : n.i18n.vars;
  const title = t(n.i18n.title, vars);
  const body = n.i18n.body ? t(n.i18n.body, vars) : n.body;
  return {
    title,
    body,
    subject: n.i18n.emailSubject ? t(n.i18n.emailSubject, vars) : (n.emailSubject ?? title),
    emailBody: n.i18n.emailBody ? t(n.i18n.emailBody, vars) : (n.emailBody ?? body),
  };
}

/**
 * Benachrichtigt Benutzer per Web Push und/oder E-Mail – gemäss ihren Einstellungen
 * (NotificationPreference; Standard: Push an, E-Mail für Rechnungen, Buchungen, Konto, Erinnerungen).
 * Wirft nie: Fehler werden geloggt, die auslösende Aktion läuft immer weiter.
 */
export async function notify(n: NotifyInput): Promise<void> {
  try {
    const tenant = n.tenantId
      ? await db.tenant.findUnique({ where: { id: n.tenantId }, select: { name: true, brandColor: true, deletedAt: true } })
      : null;
    // Gelöschter (oder unbekannter) Verein: keine Benachrichtigungen mehr
    if (n.tenantId && (!tenant || tenant.deletedAt)) return;

    const recipients = await loadRecipients(n.tenantId, n.userIds);
    if (!recipients.length) return;

    const prefs = await db.notificationPreference.findMany({
      where: { userId: { in: recipients.map((r) => r.id) }, topic: n.topic },
      select: { userId: true, channel: true, topic: true, enabled: true },
    });
    const prefsByUser = new Map<string, PreferenceRow[]>();
    for (const p of prefs) {
      const list = prefsByUser.get(p.userId) ?? [];
      list.push(p);
      prefsByUser.set(p.userId, list);
    }
    const wants = (userId: string, channel: "PUSH" | "EMAIL") => resolvePreference(prefsByUser.get(userId) ?? [], channel, n.topic);

    // --- Push: pro Sprache ein Versand ---------------------------------------------
    if (n.push !== false) {
      const byLocale = new Map<Locale, string[]>();
      for (const r of recipients) {
        if (!wants(r.id, "PUSH")) continue;
        const list = byLocale.get(r.locale) ?? [];
        list.push(r.id);
        byLocale.set(r.locale, list);
      }
      for (const [locale, ids] of byLocale) {
        const tx = textsFor(n, locale);
        await sendPush(ids, { title: tx.title, body: tx.body, url: n.url, tag: n.tag, lang: INTL_LOCALE[locale] }, { urgency: n.urgency ?? (n.topic === "chat" ? "high" : "normal") });
      }
    }

    // --- E-Mail ---------------------------------------------------------------------
    if (n.email !== false) {
      for (const r of recipients) {
        if (!wants(r.id, "EMAIL") || !r.email.includes("@")) continue;
        try {
          const t = getT(r.locale);
          const tx = textsFor(n, r.locale);
          const footer = tenant ? t("notify.mail.footer", { club: tenant.name }) : t("notify.mail.footerNoClub");
          const mail = renderMail({
            locale: r.locale,
            title: tx.title,
            paragraphs: tx.emailBody.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
            button: n.url ? { label: t("notify.mail.open"), url: appUrl(n.url) } : undefined,
            footer,
            tenantName: tenant?.name,
            accent: tenant?.brandColor ?? undefined,
          });
          await enqueueMail({
            tenantId: n.tenantId,
            kind: MAIL_KIND[n.topic],
            to: r.email,
            toName: r.name,
            subject: truncateText(tx.subject, 180),
            text: mail.text,
            html: mail.html,
            dedupeKey: n.dedupeKey ? `${n.dedupeKey}:${r.id}`.slice(0, 191) : undefined,
          });
        } catch (e) {
          console.error("notify: E-Mail konnte nicht eingereiht werden:", (e as Error).message);
        }
      }
    }
  } catch (e) {
    console.error("notify fehlgeschlagen:", (e as Error).message);
  }
}

/** Wie notify(), aber ohne Warten (für Server Actions, die sofort antworten sollen). */
export function notifyInBackground(n: NotifyInput): void {
  void notify(n).catch(() => undefined);
}

/** Alle Benutzer eines Vereins mit einer Mindestrolle bzw. Berechtigung (z.B. Admins für Buchungsanfragen). */
export async function tenantUserIdsWithRole(tenantId: string, roles: string[]): Promise<string[]> {
  const rows = await db.membership.findMany({ where: { tenantId, role: { in: roles }, status: { not: "LEFT" } }, select: { userId: true } });
  return rows.map((r) => r.userId);
}
