import "server-only";
/**
 * Web Push (VAPID). Einrichtung auf dem Server (.env):
 *   npx web-push generate-vapid-keys
 *   VAPID_PUBLIC_KEY=<Public Key>
 *   VAPID_PRIVATE_KEY=<Private Key>
 *   VAPID_SUBJECT=mailto:info@standchef.ch
 * Fehlen die Schlüssel, wird Push still übersprungen (E-Mails laufen weiter).
 * Schlüssel nie wechseln: bestehende Geräte müssten sich sonst neu anmelden.
 */
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import webpush from "web-push";
import { db } from "@/lib/db";
import { isPrivateAddress, safeAppPath, truncateText, validateEndpoint } from "./endpoint";

export { validateEndpoint, isPrivateAddress, truncateText, safeAppPath } from "./endpoint";

/** Höchstens so viele Geräte pro Benutzer (älteste werden beim Anmelden entfernt). */
export const MAX_SUBSCRIPTIONS_PER_USER = 10;

export type PushPayload = {
  title: string;
  body: string;
  /** Relativer Pfad in der App, z.B. /chat/abc */
  url?: string;
  /** Gruppierung: gleiche tag ersetzt die vorherige Benachrichtigung (z.B. chat:<id>). */
  tag?: string;
};

export type PushOptions = {
  /** Sekunden, die der Push-Dienst die Nachricht für ein Gerät offline aufbewahrt. */
  ttl?: number;
  urgency?: "very-low" | "low" | "normal" | "high";
};

type VapidConfig = { publicKey: string; privateKey: string; subject: string };

function vapid(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:info@standchef.ch";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

let configuredFor: string | null = null;
function ensureConfigured(): boolean {
  const v = vapid();
  if (!v) return false;
  const key = `${v.publicKey}|${v.subject}`;
  if (configuredFor !== key) {
    try {
      webpush.setVapidDetails(v.subject, v.publicKey, v.privateKey);
      configuredFor = key;
    } catch (e) {
      console.error("Web Push: VAPID-Konfiguration ungültig:", (e as Error).message);
      return false;
    }
  }
  return true;
}

export function isPushConfigured(): boolean {
  return vapid() !== null;
}

export function vapidPublicKey(): string | null {
  return vapid()?.publicKey ?? null;
}

export function endpointHash(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

/** Prüft Endpunkt-Syntax und dass der Host nur auf öffentliche Adressen auflöst. */
export async function assertPublicEndpoint(endpoint: string): Promise<string | null> {
  const err = validateEndpoint(endpoint);
  if (err) return err;
  const host = new URL(endpoint).hostname;
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) return "Ungültiger Push-Endpunkt.";
  } catch {
    return "Push-Dienst nicht erreichbar.";
  }
  return null;
}

/** Speichert (oder aktualisiert) ein Gerät und hält die Anzahl pro Benutzer begrenzt. */
export async function saveSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string; userAgent?: string | null }) {
  const hash = endpointHash(sub.endpoint);
  const userAgent = sub.userAgent ? sub.userAgent.slice(0, 191) : null;
  await db.pushSubscription.upsert({
    where: { endpointHash: hash },
    // Gehört der Endpunkt einem anderen Konto (Gerät geteilt, neu angemeldet), übernimmt ihn das aktuelle.
    update: { userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, userAgent },
    create: { userId, endpointHash: hash, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, userAgent },
  });
  const all = await db.pushSubscription.findMany({ where: { userId }, orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }], select: { id: true } });
  if (all.length > MAX_SUBSCRIPTIONS_PER_USER) {
    await db.pushSubscription.deleteMany({ where: { id: { in: all.slice(MAX_SUBSCRIPTIONS_PER_USER).map((s) => s.id) } } });
  }
}

export async function deleteSubscription(userId: string, endpoint: string) {
  const res = await db.pushSubscription.deleteMany({ where: { userId, endpointHash: endpointHash(endpoint) } });
  return res.count;
}

function buildPayload(p: PushPayload): string {
  return JSON.stringify({
    title: truncateText(p.title || "Standchef", 120),
    body: truncateText(p.body || "", 300),
    url: safeAppPath(p.url),
    tag: p.tag ? p.tag.slice(0, 100) : undefined,
  });
}

/**
 * Sendet eine Push-Benachrichtigung an alle Geräte der Benutzer.
 * Abgelaufene Geräte (404/410) werden gelöscht. Wirft nie; Rückgabe: Anzahl zugestellter Geräte.
 */
export async function sendPush(userIds: string[], payload: PushPayload, opts: PushOptions = {}): Promise<number> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length || !ensureConfigured()) return 0;
  let subs: Array<{ id: string; userId: string; endpoint: string; p256dh: string; auth: string }>;
  try {
    subs = await db.pushSubscription.findMany({
      where: { userId: { in: ids } },
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
    });
  } catch (e) {
    console.error("Web Push: Geräte konnten nicht geladen werden:", (e as Error).message);
    return 0;
  }
  // Pro Benutzer höchstens MAX_SUBSCRIPTIONS_PER_USER Geräte
  const perUser = new Map<string, number>();
  subs = subs.filter((s) => {
    const n = (perUser.get(s.userId) ?? 0) + 1;
    perUser.set(s.userId, n);
    return n <= MAX_SUBSCRIPTIONS_PER_USER;
  });
  if (!subs.length) return 0;

  const body = buildPayload(payload);
  const options = { TTL: opts.ttl ?? 60 * 60 * 24, urgency: opts.urgency ?? "normal", timeout: 10_000 } as const;
  const gone: string[] = [];
  const delivered: string[] = [];

  // In kleinen Paketen senden, damit grosse Vereine den Prozess nicht blockieren.
  const BATCH = 20;
  for (let i = 0; i < subs.length; i += BATCH) {
    await Promise.all(
      subs.slice(i, i + BATCH).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, options);
          delivered.push(s.id);
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(s.id);
          // 401/403 deuten auf ein VAPID-Problem hin (Konfiguration) – Geräte nicht löschen.
          else console.error(`Web Push fehlgeschlagen (${status ?? "Netzwerk"}).`);
        }
      }),
    );
  }
  try {
    if (gone.length) await db.pushSubscription.deleteMany({ where: { id: { in: gone } } });
    if (delivered.length) await db.pushSubscription.updateMany({ where: { id: { in: delivered } }, data: { lastUsedAt: new Date() } });
  } catch {
    // Aufräumen ist nicht kritisch.
  }
  return delivered.length;
}
