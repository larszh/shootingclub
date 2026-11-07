/**
 * Kantonal-/Regionalverband: reine Zugriffsregeln (ohne DB, ohne "server-only", getestet).
 *
 * Grundsätze:
 * - Zugang zum Verbandsbereich haben nur Super-Admins und Benutzer mit einer AssociationAdmin-Zeile
 *   (Rolle ADMIN oder VIEWER). Tenant-Rollen spielen keine Rolle.
 * - Ein Verband sieht von einem Verein nur Kennzahlen, und nur solange die Verbindung APPROVED ist,
 *   der Verein zugestimmt hat (consentAt) und der Verein nicht gelöscht ist (Tenant.deletedAt).
 *   PENDING, REVOKED oder ohne Zustimmung → gar nichts.
 * - Namen von Schützen erscheinen nur in Verbandsranglisten und nur, wenn der Verein shareNames
 *   eingeschaltet hat. Kontaktdaten, Rechnungen, Chat und Dateien werden nie geteilt.
 */

export const ASSOCIATION_MEMBER_STATUSES = ["PENDING", "APPROVED", "REVOKED"] as const;
export type AssociationMemberStatus = (typeof ASSOCIATION_MEMBER_STATUSES)[number];

export const ASSOCIATION_MEMBER_STATUS_LABELS: Record<AssociationMemberStatus, string> = {
  PENDING: "Wartet auf Freigabe",
  APPROVED: "Aktiv",
  REVOKED: "Beendet",
};

/** Bezeichnung des Status; mit `t` in der Sprache der Seite (Schlüssel «adm2.assoc.status.<S>»). */
export function associationStatusLabel(status: string, t?: (key: string) => string): string {
  const de = (ASSOCIATION_MEMBER_STATUS_LABELS as Record<string, string>)[status];
  if (!de) return status;
  return t ? t(`adm2.assoc.status.${status}`) : de;
}

export function associationStatusTone(status: string): "ok" | "warn" | "neutral" {
  return status === "APPROVED" ? "ok" : status === "PENDING" ? "warn" : "neutral";
}

export const ASSOCIATION_ADMIN_ROLES = ["ADMIN", "VIEWER"] as const;
export type AssociationAdminRole = (typeof ASSOCIATION_ADMIN_ROLES)[number];

export const ASSOCIATION_ADMIN_ROLE_LABELS: Record<AssociationAdminRole, string> = {
  ADMIN: "Verbandsadmin",
  VIEWER: "Nur lesen",
};

export function isAssociationAdminRole(r: string): r is AssociationAdminRole {
  return (ASSOCIATION_ADMIN_ROLES as readonly string[]).includes(r);
}

/** Effektive Rolle im Verbandsbereich: SUPER (Super-Admin), ADMIN, VIEWER oder null (kein Zugang). */
export type AssociationAccess = "SUPER" | AssociationAdminRole;

export type AccessActor = { isSuperAdmin: boolean };
export type AdminRowLite = { associationId: string; role: string };
export type AssociationLite = { id: string; deletedAt: Date | null };

/**
 * Rolle eines Benutzers für einen Verband. Gelöschte Verbände sind nur für Super-Admins sichtbar
 * (zum Wiederherstellen), unbekannte Rollen geben keinen Zugang.
 */
export function associationAccess(actor: AccessActor, association: AssociationLite | null | undefined, adminRows: readonly AdminRowLite[]): AssociationAccess | null {
  if (!association) return null;
  if (actor.isSuperAdmin) return "SUPER";
  if (association.deletedAt) return null;
  const row = adminRows.find((r) => r.associationId === association.id);
  if (!row || !isAssociationAdminRole(row.role)) return null;
  return row.role;
}

/** Vereine freigeben, ablehnen oder entfernen: Super-Admin und Verbandsadmin, nicht «Nur lesen». */
export function canManageClubs(access: AssociationAccess | null): boolean {
  return access === "SUPER" || access === "ADMIN";
}

/** Kennzahlen lesen: jede Rolle mit Zugang. */
export function canReadAggregates(access: AssociationAccess | null): boolean {
  return access !== null;
}

/** Hat der Benutzer überhaupt einen Verbandsbereich (Navigationseintrag)? */
export function hasAnyAssociationAccess(actor: AccessActor, adminRows: readonly AdminRowLite[]): boolean {
  return actor.isSuperAdmin || adminRows.some((r) => isAssociationAdminRole(r.role));
}

export type MemberLinkLite = {
  tenantId: string;
  status: string;
  consentAt: Date | null;
  shareNames: boolean;
  tenantDeletedAt: Date | null;
};

/** Teilt dieser Verein aktuell Kennzahlen mit dem Verband? */
export function sharesAggregates(m: MemberLinkLite): boolean {
  return m.status === "APPROVED" && m.consentAt !== null && m.tenantDeletedAt === null;
}

/** Teilt dieser Verein zusätzlich Namen für Verbandsranglisten? */
export function sharesNames(m: MemberLinkLite): boolean {
  return sharesAggregates(m) && m.shareNames;
}

/**
 * Vereine, deren Kennzahlen ein Verbandsbenutzer lesen darf. Ohne Lesezugriff: leere Liste.
 * Das ist die einzige Stelle, aus der die Abfragen ihre tenantIds beziehen.
 */
export function readableClubIds(access: AssociationAccess | null, members: readonly MemberLinkLite[]): string[] {
  if (!canReadAggregates(access)) return [];
  return [...new Set(members.filter(sharesAggregates).map((m) => m.tenantId))];
}

/** Vereine, deren Namen in Ranglisten erscheinen dürfen (Teilmenge von readableClubIds). */
export function nameSharingClubIds(access: AssociationAccess | null, members: readonly MemberLinkLite[]): string[] {
  if (!canReadAggregates(access)) return [];
  return [...new Set(members.filter(sharesNames).map((m) => m.tenantId))];
}

// ---------------------------------------------------------------------------
// Statuswechsel
// ---------------------------------------------------------------------------

export type ClubAction = "request" | "leave";
export type AssociationAction = "approve" | "reject" | "remove";

/**
 * Verein: Beitritt beantragen (neu oder nach einem Austritt erneut) oder austreten.
 * Liefert den neuen Status oder einen Fehlertext.
 */
export function clubTransition(current: string | null, action: ClubAction): { ok: true; status: AssociationMemberStatus } | { ok: false; error: string } {
  if (action === "request") {
    if (current === "PENDING") return { ok: false, error: "adm2.assoc.msg.pending" };
    if (current === "APPROVED") return { ok: false, error: "adm2.assoc.msg.alreadyMember" };
    return { ok: true, status: "PENDING" };
  }
  if (current === "PENDING" || current === "APPROVED") return { ok: true, status: "REVOKED" };
  return { ok: false, error: "adm2.assoc.msg.notLinked" };
}

/** Verband: hängige Anfrage freigeben oder ablehnen, aktiven Verein entfernen. */
export function associationTransition(current: string, action: AssociationAction): { ok: true; status: AssociationMemberStatus } | { ok: false; error: string } {
  if (action === "approve") {
    if (current !== "PENDING") return { ok: false, error: "adm2.assoc.msg.onlyPendingApprove" };
    return { ok: true, status: "APPROVED" };
  }
  if (action === "reject") {
    if (current !== "PENDING") return { ok: false, error: "adm2.assoc.msg.onlyPendingReject" };
    return { ok: true, status: "REVOKED" };
  }
  if (current !== "APPROVED") return { ok: false, error: "adm2.assoc.msg.onlyActiveRemove" };
  return { ok: true, status: "REVOKED" };
}

// ---------------------------------------------------------------------------
// Beitrittscode
// ---------------------------------------------------------------------------

export const ASSOCIATION_CODE_LENGTH = 8;

/** Eingabe normalisieren: Grossbuchstaben, ohne Leer- und Trennzeichen. Ungültig → null. */
export function normalizeAssociationCode(raw: string | null | undefined): string | null {
  const s = (raw ?? "").toUpperCase().replace(/[\s-]/g, "");
  if (!/^[A-Z0-9]{4,8}$/.test(s)) return null;
  return s;
}

/** Text der Zustimmung, wie er dem Verein beim Beitritt gezeigt wird (bewusst ausführlich). */
export const CONSENT_POINTS = [
  "Anzahl Mitglieder nach Status (aktiv, Junioren) – nur Zahlen.",
  "Obligatorisch-Statistik pro Jahr aus bestätigten amtlichen Resultaten: Anzahl Schützen, bestanden, nicht bestanden, verblieben – nur Zahlen.",
  "Feldschiessen-Beteiligung pro Jahr – nur Zahlen.",
  "Fristen der Bundesübungen und Anzahl noch nicht bestätigter Resultate.",
  "Für Verbandsranglisten: Anzahl Resultate. Namen, Verein und Resultat der Schützen nur, wenn ihr «Namen teilen» einschaltet.",
] as const;

export const NEVER_SHARED = "Nie geteilt werden Kontaktdaten (Adresse, E-Mail, Telefon), Geburtsdaten, Rechnungen und Zahlungen, Chat, Dateien, Notizen und alle übrigen Vereinsdaten.";
