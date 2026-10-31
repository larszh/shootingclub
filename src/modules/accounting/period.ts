/**
 * Buchungsperiode für den Buchhaltungsexport (rein). Daten sind Kalendertage in Schweizer Zeit
 * im Format YYYY-MM-DD, beide Grenzen inklusive.
 */

export type PeriodKind = "year" | "quarter" | "month" | "custom";

export type Period = { kind: PeriodKind; from: string; to: string; year: number; quarter: number; month: number; label: string };

export type PeriodParams = { period?: string; year?: string; q?: string; m?: string; from?: string; to?: string };

export const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Längster erlaubter Zeitraum (freie Periode, Export), damit eine Abfrage überschaubar bleibt. */
export const MAX_PERIOD_DAYS = 3 * 366;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Gültiges Kalenderdatum YYYY-MM-DD (z.B. kein 31.02.). */
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = ISO.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

const pad = (n: number) => String(n).padStart(2, "0");

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** «05.03.2026» aus «2026-03-05». */
export function formatDateCh(iso: string) {
  const m = ISO.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function intIn(raw: string | undefined, min: number, max: number, fallback: number) {
  const n = Number(raw);
  return raw && Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

/**
 * Periode aus den Suchparametern. Ungültige Angaben fallen auf sinnvolle Standards zurück
 * (laufendes Jahr, aktuelles Quartal bzw. aktueller Monat). `today` = heute in Schweizer Zeit.
 */
export function resolvePeriod(params: PeriodParams, today: string): Period {
  const [ty, tm] = today.split("-").map(Number) as [number, number];
  const kind: PeriodKind = params.period === "quarter" || params.period === "month" || params.period === "custom" ? params.period : "year";
  const year = intIn(params.year, 2000, 2100, ty);
  const quarter = intIn(params.q, 1, 4, Math.floor((tm - 1) / 3) + 1);
  const month = intIn(params.m, 1, 12, tm);

  if (kind === "quarter") {
    const m1 = (quarter - 1) * 3 + 1;
    return { kind, year, quarter, month, from: `${year}-${pad(m1)}-01`, to: `${year}-${pad(m1 + 2)}-${pad(lastDayOfMonth(year, m1 + 2))}`, label: `${quarter}. Quartal ${year}` };
  }
  if (kind === "month") {
    return { kind, year, quarter, month, from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}`, label: `${MONTH_NAMES[month - 1]} ${year}` };
  }
  if (kind === "custom") {
    const custom = validateRange(params.from, params.to);
    const from = custom.ok ? custom.from : `${ty}-01-01`;
    const to = custom.ok ? custom.to : today;
    return { kind, year, quarter, month, from, to, label: `${formatDateCh(from)} – ${formatDateCh(to)}` };
  }
  return { kind: "year", year, quarter, month, from: `${year}-01-01`, to: `${year}-12-31`, label: `Jahr ${year}` };
}

/** Prüft einen freien Zeitraum (Export-Route, freie Periode). */
export function validateRange(from: unknown, to: unknown): { ok: true; from: string; to: string } | { ok: false; error: string } {
  if (!isIsoDate(from) || !isIsoDate(to)) return { ok: false, error: "Bitte Von- und Bis-Datum im Format JJJJ-MM-TT angeben." };
  if (from > to) return { ok: false, error: "Das Von-Datum liegt nach dem Bis-Datum." };
  if (daysBetween(from, to) > MAX_PERIOD_DAYS) return { ok: false, error: "Der Zeitraum ist zu lang (höchstens drei Jahre)." };
  return { ok: true, from, to };
}
