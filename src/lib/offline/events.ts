// Ereignisse der Offline-Schicht (Outbox geändert, Operation bestätigt, Durchgang zugeordnet …).
// Wird zusätzlich per BroadcastChannel an andere Tabs weitergereicht.
import type { SyncEvent } from "./types";

type Listener = (ev: SyncEvent) => void;
const listeners = new Set<Listener>();
let channel: BroadcastChannel | null | undefined;

function getChannel() {
  if (channel !== undefined) return channel;
  channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("standchef-offline") : null;
  if (channel) {
    channel.onmessage = (msg: MessageEvent<SyncEvent>) => {
      // Ereignisse anderer Tabs lokal weitergeben (nicht erneut senden)
      for (const l of listeners) l(msg.data);
    };
  }
  return channel;
}

export function onSyncEvent(listener: Listener): () => void {
  getChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSyncEvent(ev: SyncEvent) {
  for (const l of listeners) {
    try {
      l(ev);
    } catch (e) {
      console.error(e);
    }
  }
  try {
    getChannel()?.postMessage(ev);
  } catch {
    // nicht serialisierbar oder Kanal geschlossen
  }
}
