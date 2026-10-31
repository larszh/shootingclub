// Qualifikationen: reine Logik ohne DB (Arten, Gültigkeit, Ablauf-Status).

export const QUALIFICATION_KINDS = [
  { key: "SCHUETZENMEISTER", label: "Schützenmeister" },
  { key: "JS_LEITER", label: "J+S-Leiter" },
  { key: "JPLUS_LEITER", label: "Jungschützenleiter" },
  { key: "FIRST_AID", label: "Erste Hilfe" },
  { key: "RANGE_OFFICER", label: "Standchef / Standaufsicht" },
  { key: "INSTRUCTOR", label: "Ausbildner / Instruktor" },
  { key: "WEAPON_QUAL", label: "Waffen-Qualifikation" },
  { key: "OTHER", label: "Andere" },
] as const satisfies ReadonlyArray<{ key: string; label: string }>;

export type QualificationKind = (typeof QUALIFICATION_KINDS)[number]["key"];

export const QUALIFICATION_KIND_KEYS = QUALIFICATION_KINDS.map((k) => k.key) as QualificationKind[];

export function isQualificationKind(k: string): k is QualificationKind {
  return (QUALIFICATION_KIND_KEYS as string[]).includes(k);
}

export function qualificationLabel(kind: string | null | undefined): string {
  if (!kind) return "";
  return QUALIFICATION_KINDS.find((k) => k.key === kind)?.label ?? kind;
}

/** Tage vor Ablauf, ab denen eine Qualifikation als «läuft ab» gilt. */
export const EXPIRY_WARN_DAYS = 60;

/** «YYYY-MM-DD» eines @db.Date-Werts (gespeichert als UTC-Mitternacht des Schweizer Kalendertags). */
export function dbDay(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Schweizer Kalendertag «YYYY-MM-DD» → Date als UTC-Mitternacht (für @db.Date-Felder). */
export function dayToDbDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function dayDiff(fromDay: string, toDay: string): number {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000);
}

/** Ist die Qualifikation am Tag `day` gültig? Grenzen inklusive, leere Grenzen = offen. */
export function isValidOn(q: { validFrom: Date | null; validUntil: Date | null }, day: string): boolean {
  const from = dbDay(q.validFrom);
  const until = dbDay(q.validUntil);
  if (from && day < from) return false;
  if (until && day > until) return false;
  return true;
}

export type QualificationState = "valid" | "expiring" | "expired" | "future";

/** Status für Badges: abgelaufen, läuft innert `warnDays` ab, noch nicht gültig oder gültig. */
export function qualificationState(
  q: { validFrom: Date | null; validUntil: Date | null },
  today: string,
  warnDays = EXPIRY_WARN_DAYS,
): { state: QualificationState; daysLeft: number | null } {
  const from = dbDay(q.validFrom);
  const until = dbDay(q.validUntil);
  const daysLeft = until ? dayDiff(today, until) : null;
  if (until && today > until) return { state: "expired", daysLeft };
  if (from && today < from) return { state: "future", daysLeft };
  if (daysLeft !== null && daysLeft <= warnDays) return { state: "expiring", daysLeft };
  return { state: "valid", daysLeft };
}
