import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { StorageError } from "./types";

/**
 * Vereins-Admins tragen Speicher-URLs selbst ein. Damit darüber keine internen Dienste
 * des Servers angesprochen werden (SSRF), sind nur öffentliche HTTPS-Adressen erlaubt.
 * Für selbst gehostete Installationen mit Nextcloud im eigenen Netz:
 * FILE_STORAGE_ALLOW_PRIVATE_HOSTS=1 erlaubt auch private Adressen und http://.
 */
function allowPrivate() {
  return process.env.FILE_STORAGE_ALLOW_PRIVATE_HOSTS === "1";
}

export function parseStorageUrl(raw: string, label: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new StorageError(`${label}: Bitte eine vollständige Adresse mit https:// angeben.`, "INVALID");
  }
  if (u.protocol !== "https:" && !(allowPrivate() && u.protocol === "http:")) {
    throw new StorageError(`${label}: Nur verschlüsselte Verbindungen (https://) sind erlaubt.`, "INVALID");
  }
  if (u.username || u.password) throw new StorageError(`${label}: Benutzername und Passwort bitte in den separaten Feldern angeben.`, "INVALID");
  return u;
}

function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff");
}

const checked = new Map<string, number>();
const CHECK_TTL_MS = 10 * 60 * 1000;

/** Wirft StorageError, wenn der Host auf eine interne Adresse zeigt. */
export async function assertPublicHost(u: URL, label: string) {
  if (allowPrivate()) return;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const now = Date.now();
  const last = checked.get(host);
  if (last && now - last < CHECK_TTL_MS) return;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new StorageError(`${label}: Interne Adressen sind nicht erlaubt.`, "INVALID");
  }
  let addresses: string[];
  if (net.isIP(host)) addresses = [host];
  else {
    try {
      addresses = (await lookup(host, { all: true })).map((a) => a.address);
    } catch {
      throw new StorageError(`${label}: Der Server «${host}» wurde nicht gefunden. Adresse prüfen.`, "NETWORK");
    }
  }
  if (addresses.length === 0 || addresses.some(isPrivateIp)) {
    throw new StorageError(`${label}: Interne Adressen sind nicht erlaubt.`, "INVALID");
  }
  checked.set(host, now);
}
