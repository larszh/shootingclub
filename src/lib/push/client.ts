/**
 * Web Push im Browser: Zustand erkennen, Gerät an- und abmelden.
 * Nur in Client-Komponenten verwenden (greift auf navigator/window zu).
 */

export type PushState =
  | "unsupported" // Browser kann kein Web Push
  | "ios-needs-install" // iPhone/iPad: erst «Zum Home-Bildschirm» hinzufügen (ab iOS 16.4)
  | "not-configured" // Server ohne VAPID-Schlüssel
  | "denied" // Benachrichtigungen im Browser blockiert
  | "enabled" // dieses Gerät erhält Benachrichtigungen
  | "disabled"; // möglich, aber nicht eingeschaltet

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS meldet sich als Mac mit Touch
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

function supportsPush(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

let cachedKey: string | null | undefined;
async function publicKey(): Promise<string | null> {
  if (cachedKey !== undefined) return cachedKey;
  try {
    const res = await fetch("/api/push/key", { cache: "no-store" });
    const data = (await res.json()) as { publicKey?: string | null };
    cachedKey = res.ok && data.publicKey ? data.publicKey : null;
  } catch {
    return null; // nicht merken: vielleicht nur offline
  }
  return cachedKey;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  // In der Entwicklung ist der Service Worker sonst nicht registriert
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

export async function getPushState(): Promise<PushState> {
  if (!supportsPush()) return isIos() && !isStandalone() ? "ios-needs-install" : "unsupported";
  if (isIos() && !isStandalone()) return "ios-needs-install";
  if (Notification.permission === "denied") return "denied";
  const key = await publicKey();
  if (!key) return "not-configured";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub && Notification.permission === "granted" ? "enabled" : "disabled";
  } catch {
    return "disabled";
  }
}

async function sendToServer(method: "POST" | "DELETE", body: unknown) {
  const res = await fetch("/api/push/subscribe", {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Das Gerät konnte nicht angemeldet werden.");
  }
}

/** Fragt nach Erlaubnis (muss durch einen Klick ausgelöst werden) und meldet das Gerät an. */
export async function enablePush(): Promise<PushState> {
  const state = await getPushState();
  if (state === "unsupported" || state === "ios-needs-install" || state === "not-configured" || state === "denied") return state;
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "disabled";
  const key = await publicKey();
  if (!key) return "not-configured";
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  try {
    await sendToServer("POST", sub.toJSON());
  } catch (e) {
    // Server lehnt ab: lokales Abo nicht verwaist zurücklassen
    await sub.unsubscribe().catch(() => false);
    throw e;
  }
  return "enabled";
}

/** Meldet dieses Gerät ab (lokal und auf dem Server). */
export async function disablePush(): Promise<PushState> {
  if (!supportsPush()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    await sendToServer("DELETE", { endpoint: sub.endpoint }).catch(() => undefined);
    await sub.unsubscribe().catch(() => false);
  }
  return "disabled";
}

/** Meldet ein bestehendes Abo erneut beim Server an (z.B. nach Kontowechsel auf demselben Gerät). */
export async function resyncPush(): Promise<void> {
  if (!supportsPush() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) await sendToServer("POST", sub.toJSON()).catch(() => undefined);
}
