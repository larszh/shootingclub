import "server-only";
import dns from "node:dns";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net, { type LookupFunction } from "node:net";
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

function isPrivateIpv4(ip: string) {
  const [a, b, c] = ip.split(".").map(Number) as [number, number, number];
  return (
    a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) || a >= 224
  );
}

/** IPv6-Adresse in 8 Blöcke à 16 Bit zerlegen (auch mit eingebetteter IPv4-Schreibweise). null = ungültig. */
function parseIpv6(raw: string): number[] | null {
  const ip = raw.split("%")[0]!.toLowerCase();
  if (net.isIPv6(ip) === false) return null;
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const toHextets = (part: string): number[] | null => {
    if (!part) return [];
    const out: number[] = [];
    for (const seg of part.split(":")) {
      if (seg.includes(".")) {
        if (!net.isIPv4(seg)) return null;
        const [a, b, c, d] = seg.split(".").map(Number) as [number, number, number, number];
        out.push((a << 8) | b, (c << 8) | d);
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(seg)) return null;
        out.push(parseInt(seg, 16));
      }
    }
    return out;
  };
  const head = toHextets(halves[0]!);
  const tail = halves.length === 2 ? toHextets(halves[1]!) : [];
  if (!head || !tail) return null;
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  return [...head, ...new Array<number>(missing).fill(0), ...tail];
}

function v4From(hi: number, lo: number) {
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

/** true = intern/nicht öffentlich (im Zweifel intern). */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  const h = parseIpv6(ip);
  if (!h) return true;
  const [h0, h1, h2, h3, h4, h5, h6, h7] = h as [number, number, number, number, number, number, number, number];
  const zero0to3 = h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0;
  // ::/96 (inkl. :: und ::1, IPv4-kompatibel), ::ffff:0:0/96 (IPv4-mapped), ::ffff:0:0:0/96 (SIIT)
  if (zero0to3 && ((h4 === 0 && h5 === 0) || (h4 === 0 && h5 === 0xffff) || (h4 === 0xffff && h5 === 0))) {
    if (h4 === 0 && h5 === 0 && h6 === 0) return true; // ::, ::1 und 0.0.x.x
    return isPrivateIpv4(v4From(h6, h7));
  }
  // NAT64 64:ff9b::/96 und lokales NAT64 64:ff9b:1::/48
  if (h0 === 0x64 && h1 === 0xff9b) {
    if (h2 !== 0 || h3 !== 0 || h4 !== 0 || h5 !== 0) return true;
    return isPrivateIpv4(v4From(h6, h7));
  }
  // 6to4 2002::/16 enthält die IPv4-Adresse in Block 1 und 2
  if (h0 === 0x2002) return isPrivateIpv4(v4From(h1, h2));
  // Teredo 2001::/32 und Dokumentation 2001:db8::/32
  if (h0 === 0x2001 && (h1 === 0 || h1 === 0xdb8)) return true;
  // 100::/64 (Discard)
  if (h0 === 0x100 && h1 === 0 && h2 === 0 && h3 === 0) return true;
  if ((h0 & 0xfe00) === 0xfc00) return true; // fc00::/7 Unique Local
  if ((h0 & 0xffc0) === 0xfe80 || (h0 & 0xffc0) === 0xfec0) return true; // fe80::/10, fec0::/10
  if ((h0 & 0xff00) === 0xff00) return true; // ff00::/8 Multicast
  return zero0to3; // übrige Adressen in ::/64 sind nicht öffentlich
}

function privateHostError(label: string) {
  return new StorageError(`${label}: Interne Adressen sind nicht erlaubt.`, "INVALID");
}

/**
 * Wirft StorageError, wenn der Host auf eine interne Adresse zeigt. Ergibt verständliche
 * Fehlermeldungen; die eigentliche Verbindung prüft die Adresse zusätzlich (safeLookup),
 * damit DNS-Rebinding zwischen Prüfung und Verbindung nicht hilft.
 */
export async function assertPublicHost(u: URL, label: string) {
  if (allowPrivate()) return;
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw privateHostError(label);
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
  if (addresses.length === 0 || addresses.some(isPrivateIp)) throw privateHostError(label);
}

/** Fehlercode, wenn eine Verbindung zu einer internen Adresse verweigert wurde. */
export const PRIVATE_ADDRESS_CODE = "EPRIVATEADDR";

/**
 * DNS-Auflösung für ausgehende Speicher-Verbindungen: verweigert interne Adressen direkt
 * beim Verbindungsaufbau (die geprüfte Adresse ist auch die verwendete).
 */
export const safeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err, address, family);
    if (!allowPrivate()) {
      const list = Array.isArray(address) ? address.map((a) => a.address) : [address];
      if (list.length === 0 || list.some(isPrivateIp)) {
        const e: NodeJS.ErrnoException = new Error("Interne Adressen sind nicht erlaubt.");
        e.code = PRIVATE_ADDRESS_CODE;
        return callback(e, address, family);
      }
    }
    callback(null, address, family);
  });
};

/** Agents für S3/WebDAV mit sicherer DNS-Auflösung. */
export const storageHttpsAgent = new https.Agent({ lookup: safeLookup, keepAlive: true, maxSockets: 50 });
export const storageHttpAgent = new http.Agent({ lookup: safeLookup, keepAlive: true, maxSockets: 50 });

export function isPrivateAddressError(e: unknown) {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === PRIVATE_ADDRESS_CODE;
}
