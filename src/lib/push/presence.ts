import "server-only";

/**
 * Wer ist gerade live verbunden (z.B. offener Chat-Stream)? In-Memory pro Prozess –
 * passt zum Betrieb mit einer PM2-Instanz. Verbundene Benutzer sehen neue Nachrichten
 * direkt in der App und erhalten deshalb keine Push-Benachrichtigung für den Chat.
 *
 * Einbindung: Der Chat-Stream ruft beim Verbinden `const leave = markOnline(userId)`
 * und beim Schliessen `leave()` auf.
 */
type Store = Map<string, number>;
const g = globalThis as unknown as { __standchefPresence?: Store };
const store = (): Store => (g.__standchefPresence ??= new Map());

export function markOnline(userId: string): () => void {
  const s = store();
  s.set(userId, (s.get(userId) ?? 0) + 1);
  let left = false;
  return () => {
    if (left) return;
    left = true;
    const n = (s.get(userId) ?? 1) - 1;
    if (n <= 0) s.delete(userId);
    else s.set(userId, n);
  };
}

export function isOnline(userId: string): boolean {
  return (store().get(userId) ?? 0) > 0;
}
