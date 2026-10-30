/**
 * Betrag in Rappen als «CHF 4’380.00». Bewusst ohne Intl.NumberFormat: dessen de-CH-Ausgabe hängt
 * von der ICU-Version ab (Node: U+2019, Chromium: ASCII-Apostroph, unterschiedliche Leerzeichen),
 * was in Client-Komponenten Hydrierungsfehler (React #418) auslöst. So rendern Server und Client gleich.
 */
export function formatMoney(cents: number, currency = "CHF"): string {
  const neg = cents < 0;
  const abs = Math.round(Math.abs(cents));
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "’");
  const frac = String(abs % 100).padStart(2, "0");
  return `${neg ? "-" : ""}${currency} ${whole}.${frac}`;
}

/** "12.50" oder "12,5" → 1250 */
export function parseMoneyToCents(input: string | number | null | undefined) {
  if (input === null || input === undefined || input === "") return 0;
  const n = typeof input === "number" ? input : Number(String(input).replace(",", ".").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
