import "server-only";
import { EventEmitter } from "node:events";
import type { ChatMessageDTO } from "./types";

/**
 * In-Process-Pub/Sub für den Chat. Liegt auf globalThis, damit Route-Handler und
 * Server Actions (getrennte Modul-Graphen) denselben Emitter teilen. Passt zum Betrieb
 * mit einer PM2-Instanz; bei mehreren Instanzen holt der Stream verpasste Ereignisse
 * zusätzlich alle 5 s aus der Datenbank (siehe src/app/api/chat/stream/route.ts).
 *
 * Datenschutz: Ereignisse enthalten Nachrichteninhalte – nie loggen. Der Stream leitet
 * nur an Mitglieder der Unterhaltung weiter.
 */
export type ChatBusEvent =
  | { type: "message"; tenantId: string; conversationId: string; message: ChatMessageDTO }
  | { type: "read"; tenantId: string; conversationId: string; userId: string; lastReadAt: string }
  | { type: "conversation"; tenantId: string; conversationId: string };

const CHANNEL = "chat";

const g = globalThis as unknown as { __standchefChatBus?: EventEmitter };

function bus() {
  if (!g.__standchefChatBus) {
    const e = new EventEmitter();
    // Jeder offene Tab hält einen Listener – kein Speicherleck, sondern viele Benutzer.
    e.setMaxListeners(0);
    g.__standchefChatBus = e;
  }
  return g.__standchefChatBus;
}

export function publishChat(event: ChatBusEvent) {
  try {
    bus().emit(CHANNEL, event);
  } catch {
    // Ein fehlerhafter Listener darf das Senden nicht abbrechen.
  }
}

export function subscribeChat(listener: (event: ChatBusEvent) => void) {
  const b = bus();
  b.on(CHANNEL, listener);
  return () => {
    b.off(CHANNEL, listener);
  };
}
