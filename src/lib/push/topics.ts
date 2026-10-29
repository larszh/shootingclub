/** Benachrichtigungs-Themen und Standardwerte (ohne Server-Abhängigkeiten, auch im Client nutzbar). */

export const NOTIFY_TOPICS = ["chat", "announcements", "events", "bookings", "invoices", "shifts", "reminders", "system"] as const;
export type NotifyTopic = (typeof NOTIFY_TOPICS)[number];
export type NotifyChannel = "PUSH" | "EMAIL";

export function isNotifyTopic(v: unknown): v is NotifyTopic {
  return typeof v === "string" && (NOTIFY_TOPICS as readonly string[]).includes(v);
}

/** Standard: Push für alle Themen an; E-Mail nur für Wichtiges (Rechnungen, Buchungen, Konto, Erinnerungen). */
const EMAIL_DEFAULT_ON: ReadonlySet<NotifyTopic> = new Set<NotifyTopic>(["invoices", "bookings", "system", "reminders"]);

export function defaultPreference(channel: NotifyChannel, topic: NotifyTopic): boolean {
  if (channel === "PUSH") return true;
  return EMAIL_DEFAULT_ON.has(topic);
}

/** Themen, die sich nicht abschalten lassen (Sicherheit des Kontos). */
export const LOCKED_EMAIL_TOPICS: ReadonlySet<NotifyTopic> = new Set<NotifyTopic>(["system"]);

/** Deutsche Bezeichnungen und Erklärungen für die Einstellungsseite. */
export const TOPIC_INFO: Record<NotifyTopic, { label: string; hint: string }> = {
  chat: { label: "Chat-Nachrichten", hint: "Neue Nachrichten, wenn du die App nicht offen hast." },
  announcements: { label: "Mitteilungen", hint: "Neue Mitteilungen des Vorstands." },
  events: { label: "Anlässe", hint: "Absagen und Änderungen bei Anlässen, für die du angemeldet bist." },
  bookings: { label: "Reservationen", hint: "Bestätigungen, Absagen und neue Anfragen." },
  invoices: { label: "Rechnungen", hint: "Neue Rechnungen, z.B. den Jahresbeitrag." },
  shifts: { label: "Helfereinsätze", hint: "Einteilungen und Änderungen bei Helfereinsätzen." },
  reminders: { label: "Erinnerungen", hint: "Zahlungserinnerungen und Termine." },
  system: { label: "Konto und Sicherheit", hint: "Anmeldungen, Passwort und wichtige Hinweise." },
};

export type PreferenceRow = { channel: string; topic: string; enabled: boolean };

/** Effektive Einstellung aus gespeicherten Zeilen und Standardwerten. */
export function resolvePreference(rows: PreferenceRow[], channel: NotifyChannel, topic: NotifyTopic): boolean {
  if (channel === "EMAIL" && LOCKED_EMAIL_TOPICS.has(topic)) return true;
  const row = rows.find((r) => r.channel === channel && r.topic === topic);
  return row ? row.enabled : defaultPreference(channel, topic);
}

export type PreferenceMatrix = Record<NotifyTopic, { push: boolean; email: boolean }>;

export function preferenceMatrix(rows: PreferenceRow[]): PreferenceMatrix {
  const out = {} as PreferenceMatrix;
  for (const t of NOTIFY_TOPICS) out[t] = { push: resolvePreference(rows, "PUSH", t), email: resolvePreference(rows, "EMAIL", t) };
  return out;
}
