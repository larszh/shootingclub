/**
 * Chat: gemeinsame Typen, Konstanten und Validierung (Server und Browser).
 * Keine Server-Imports, damit Client-Komponenten die Datei nutzen können.
 */
import { z } from "zod";

export const CHAT_KINDS = ["DIRECT", "GROUP"] as const;
export type ChatKind = (typeof CHAT_KINDS)[number];

export const CHAT_ROLES = ["ADMIN", "MEMBER"] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

/** Maximale Länge einer Nachricht (Spalte body ist @db.Text). */
export const MAX_MESSAGE_LENGTH = 4000;
/** Gruppennamen passen in eine VARCHAR(191)-Spalte; kürzer ist auf dem Handy lesbarer. */
export const MAX_TITLE_LENGTH = 80;
/** Eigene Nachrichten dürfen so lange bearbeitet oder gelöscht werden. */
export const EDIT_WINDOW_MS = 15 * 60_000;
/** Seitengrösse beim Laden von Nachrichten. */
export const PAGE_SIZE = 40;
/** Platzhalter für gelöschte Nachrichten in der Oberfläche. */
export const DELETED_LABEL = "Nachricht gelöscht";

/** Eindeutiger Schlüssel für 1:1-Unterhaltungen: "<tenantId>:<kleinere userId>:<grössere userId>". */
export function directKeyFor(tenantId: string, a: string, b: string) {
  const [x, y] = a < b ? [a, b] : [b, a];
  return `${tenantId}:${x}:${y}`;
}

/** Teilnehmer einer 1:1-Unterhaltung aus dem directKey. */
export function directParticipants(directKey: string | null | undefined): [string, string] | null {
  if (!directKey) return null;
  const parts = directKey.split(":");
  if (parts.length !== 3 || parts[2] === "club") return null;
  return [parts[1]!, parts[2]!];
}

/**
 * Synchronisierte «Vereins-Gruppe»: Das Schema hat kein eigenes Feld dafür, deshalb wird
 * directKey (unique) bei Gruppen als Markierung "<tenantId>:club" genutzt. Damit gibt es
 * höchstens eine synchronisierte Vereins-Gruppe pro Verein.
 */
export function clubKeyFor(tenantId: string) {
  return `${tenantId}:club`;
}

export function isClubKey(key: string | null | undefined) {
  return !!key && key.endsWith(":club");
}

export const messageBodySchema = z
  .string()
  .transform((s) => s.replace(/\r\n/g, "\n").trim())
  .pipe(z.string().max(MAX_MESSAGE_LENGTH, `Höchstens ${MAX_MESSAGE_LENGTH} Zeichen.`));

export const clientIdSchema = z.string().uuid("Ungültige Nachrichten-ID.");

export const sendMessageSchema = z.object({
  clientId: clientIdSchema,
  body: messageBodySchema,
});

export const groupTitleSchema = z
  .string()
  .trim()
  .min(1, "Bitte einen Namen eingeben.")
  .max(MAX_TITLE_LENGTH, `Höchstens ${MAX_TITLE_LENGTH} Zeichen.`);

export const idSchema = z.string().min(1).max(64);

/* ---------------------------------------------------------------- DTOs */

export type ChatFileDTO = { id: string; name: string; mimeType: string; sizeBytes: number };

export type ChatMessageDTO = {
  id: string;
  conversationId: string;
  clientId: string | null;
  senderId: string | null;
  senderName: string;
  senderAvatar: string | null;
  /** Leer, wenn gelöscht */
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  file: ChatFileDTO | null;
};

export type ChatMemberDTO = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: ChatRole;
  lastReadAt: string | null;
};

export type ChatReadDTO = { userId: string; lastReadAt: string };

/** Ereignisse, die über /api/chat/stream an den Browser gehen. */
export type ChatStreamEvent =
  | { type: "hello"; userId: string; tenantId: string }
  | { type: "message"; conversationId: string; muted: boolean; message: ChatMessageDTO }
  | { type: "read"; conversationId: string; userId: string; lastReadAt: string }
  | { type: "conversation"; conversationId: string };

export type MessagesResponse = {
  messages: ChatMessageDTO[];
  /** Für ?after=: nächster Cursor (ISO-Zeitpunkt) */
  cursor: string;
  /** ?before=: gibt es noch ältere Nachrichten? ?after=: gibt es weitere Änderungen (gleich nochmals abfragen)? */
  hasMore: boolean;
  reads: ChatReadDTO[];
};

export function chatFileUrl(fileId: string) {
  return `/api/documents/${fileId}`;
}

export function isImageMime(mime: string) {
  return /^image\/(png|jpe?g|gif|webp|avif)$/i.test(mime);
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
