/**
 * QR-Referenz (QRR) nach Swiss Payment Standards.
 *
 * - 27 Ziffern, die letzte ist eine Prüfziffer nach «Modulo 10 rekursiv».
 * - Nur zusammen mit einer QR-IBAN zulässig (IID 30000–31999).
 * - Darstellung: «21 00000 00003 13947 14300 09017» (2er-Block, dann 5er-Blöcke).
 *
 * Diese Datei ist bewusst ohne Abhängigkeiten und läuft auf Server und Client.
 */

const MOD10_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5] as const;

/** Entfernt Leerzeichen und macht Grossbuchstaben (IBAN/Referenz). */
export function compactCode(input: string | null | undefined) {
  return (input ?? "").replace(/\s+/g, "").toUpperCase();
}

/** Schweizer oder Liechtensteiner QR-IBAN: IID (Stellen 5–9) liegt zwischen 30000 und 31999. */
export function isQrIban(iban: string | null | undefined) {
  const s = compactCode(iban);
  if (!/^(CH|LI)\d{2}\d{5}[A-Z0-9]{12}$/.test(s)) return false;
  const iid = Number(s.slice(4, 9));
  return iid >= 30000 && iid <= 31999;
}

/** Prüfziffer «Modulo 10 rekursiv» für eine Ziffernfolge. */
export function mod10RecursiveCheckDigit(digits: string) {
  if (!/^\d*$/.test(digits)) throw new Error("Nur Ziffern erlaubt");
  let carry = 0;
  for (const ch of digits) carry = MOD10_TABLE[(carry + Number(ch)) % 10]!;
  return (10 - carry) % 10;
}

/**
 * Erstellt eine 27-stellige QR-Referenz aus einer numerischen Basis (max. 26 Ziffern).
 * Kürzere Basen werden links mit Nullen aufgefüllt.
 */
export function createQrReference(numericBase: string | number | bigint) {
  const base = String(numericBase).replace(/\s+/g, "");
  if (!/^\d{1,26}$/.test(base)) throw new Error("Die Basis der QR-Referenz muss aus 1 bis 26 Ziffern bestehen.");
  const padded = base.padStart(26, "0");
  return padded + String(mod10RecursiveCheckDigit(padded));
}

/** Prüft eine QR-Referenz (27 Ziffern, Prüfziffer korrekt). Leerzeichen sind erlaubt. */
export function isValidQrReference(ref: string | null | undefined) {
  const s = compactCode(ref);
  if (!/^\d{27}$/.test(s)) return false;
  if (/^0+$/.test(s)) return false;
  return mod10RecursiveCheckDigit(s.slice(0, 26)) === Number(s[26]);
}

/** «210000000003139471430009017» → «21 00000 00003 13947 14300 09017» (5er-Gruppen von rechts). */
export function formatQrReference(ref: string | null | undefined) {
  const s = compactCode(ref);
  if (!s) return "";
  const groups: string[] = [];
  for (let end = s.length; end > 0; end -= 5) groups.unshift(s.slice(Math.max(0, end - 5), end));
  return groups.join(" ");
}

/** IBAN in 4er-Gruppen. */
export function formatIban(iban: string | null | undefined) {
  return compactCode(iban).replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Leitet aus einer beliebigen Kennung (z.B. Tenant-ID) eine stabile numerische Kennzahl
 * mit `length` Stellen ab (FNV-1a, nicht kryptografisch – nur zur Unterscheidung).
 */
export function numericPrefixFrom(id: string, length = 6) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const mod = 10 ** length;
  return String(h % mod).padStart(length, "0");
}
