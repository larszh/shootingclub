/**
 * Prüfungen für Web-Push-Endpunkte (rein funktional, ohne Netzwerk).
 * Push-Dienste (FCM, Mozilla, Apple, WNS) haben immer öffentliche https-Hostnamen.
 * Alles andere wird abgelehnt, damit der Server keine internen Adressen aufruft (SSRF).
 */

export const MAX_ENDPOINT_LENGTH = 2048;

/** true für IPv4/IPv6-Adressen aus privaten, Loopback-, Link-Local- oder reservierten Bereichen. */
export function isPrivateAddress(ip: string): boolean {
  const addr = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (addr.includes(":")) {
    if (addr === "::" || addr === "::1") return true;
    const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    if (/^f[cd][0-9a-f]{2}:/.test(addr)) return true; // fc00::/7 Unique Local
    if (/^fe[89ab][0-9a-f]:/.test(addr)) return true; // fe80::/10 Link-Local
    if (addr.startsWith("ff")) return true; // Multicast
    if (addr.startsWith("64:ff9b:") || addr.startsWith("2001:db8:")) return true;
    return false;
  }
  const parts = addr.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // Multicast und reserviert
  return false;
}

function isIpLiteral(host: string) {
  return /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":") || /^\[.*\]$/.test(host);
}

/**
 * Syntaktische Prüfung eines Endpunkts. Rückgabe: null = in Ordnung, sonst Fehlertext.
 * (Die DNS-Auflösung prüft der Server zusätzlich, siehe assertPublicHost in ./index.)
 */
export function validateEndpoint(endpoint: string): string | null {
  if (!endpoint || endpoint.length > MAX_ENDPOINT_LENGTH) return "Ungültiger Push-Endpunkt.";
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return "Ungültiger Push-Endpunkt.";
  }
  if (url.protocol !== "https:") return "Push-Endpunkt muss https verwenden.";
  if (url.username || url.password) return "Ungültiger Push-Endpunkt.";
  if (url.port && url.port !== "443") return "Ungültiger Push-Endpunkt.";
  const host = url.hostname.toLowerCase();
  if (!host || isIpLiteral(host)) return "Ungültiger Push-Endpunkt.";
  if (!host.includes(".")) return "Ungültiger Push-Endpunkt.";
  if (host === "localhost" || /\.(localhost|local|internal|lan|home|intranet|corp)$/.test(host)) return "Ungültiger Push-Endpunkt.";
  return null;
}

/** Schlüssel einer Push-Subscription sind base64url-codiert. */
export function isBase64Url(s: string, min: number, max: number) {
  return s.length >= min && s.length <= max && /^[A-Za-z0-9_-]+={0,2}$/.test(s);
}

/** Kürzt Text für Benachrichtigungen (an Wortgrenze, mit …). */
export function truncateText(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + "…";
}

/** Nur relative Pfade derselben App zulassen (verhindert Open Redirects aus Benachrichtigungen). */
export function safeAppPath(url: string | null | undefined): string {
  if (!url) return "/";
  if (!url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) return "/";
  return url.slice(0, 500);
}
