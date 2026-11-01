export const TENANT_ROLES = ["OWNER", "ADMIN", "TRAINER", "MEMBER"] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export const ROLE_LABELS: Record<TenantRole, string> = {
  OWNER: "Inhaber",
  ADMIN: "Admin",
  TRAINER: "Trainer",
  MEMBER: "Mitglied",
};

const RANK: Record<TenantRole, number> = { OWNER: 4, ADMIN: 3, TRAINER: 2, MEMBER: 1 };

export function isTenantRole(r: string): r is TenantRole {
  return (TENANT_ROLES as readonly string[]).includes(r);
}

export function roleAtLeast(role: string | null | undefined, min: TenantRole) {
  if (!role || !isTenantRole(role)) return false;
  return RANK[role] >= RANK[min];
}

export type Permission =
  | "tenant.manage" // Mitglieder, Module, Einstellungen
  | "tenant.programs.manage" // Programme des Tenants anlegen/bearbeiten/verstecken
  | "tenant.targets.manage" // Scheiben des Tenants anlegen/verstecken
  | "match.viewAll" // alle Resultate im Tenant sehen
  | "match.create"
  | "match.delete"
  | "events.manage" // Anlässe erfassen, bearbeiten, absagen, Anmeldelisten
  | "announcements.manage" // Mitteilungen an alle erfassen
  | "files.manage" // Dateiablage: Ordner, Sichtbarkeit, fremde Dateien verwalten
  | "files.upload" // Dateiablage: Dateien hochladen
  | "ammo.manage" // Munition: Einstellungen, Sortiment, Ausgabe, Rechnungen
  | "members.view" // Mitgliederliste mit Kontaktdaten sehen
  | "members.manage" // Mitgliederdaten, Import, Haushalte, Einladungen
  | "audit.view" // Protokoll der Änderungen im Verein
  | "results.verify" // amtliche Resultate bestätigen (Schützenmeister)
  | "range.duty" // Standdienst: Standbuch öffnen, Check-in, Gäste
  | "range.manage" // Standordnung, Schiesszeiten, Kontingent, Vorfälle
  | "weapons.loan" // Vereinswaffen ausgeben und zurücknehmen
  | "weapons.manage" // Vereinswaffen erfassen, Wartung
  | "shifts.manage" // Helfereinsätze planen, Stunden bestätigen
  | "courses.manage" // Kurse (Jungschützen, J+S, Ausbildung) führen
  | "championship.manage" // Jahresmeisterschaft einrichten
  | "qualifications.manage" // Qualifikationen erfassen und bestätigen
  | "kiosk.sell" // Konsumationen in der Schützenstube erfassen
  | "kiosk.manage" // Sortiment, Preise, Abrechnung der Schützenstube
  | "accounting.export"; // Buchhaltungsexport, Kontenplan

const PERMISSION_MIN_ROLE: Record<Permission, TenantRole> = {
  "tenant.manage": "ADMIN",
  "tenant.programs.manage": "ADMIN",
  "tenant.targets.manage": "ADMIN",
  "match.viewAll": "TRAINER",
  "match.create": "MEMBER",
  "match.delete": "ADMIN",
  "events.manage": "TRAINER",
  "announcements.manage": "ADMIN",
  "files.manage": "ADMIN",
  "files.upload": "MEMBER",
  "ammo.manage": "ADMIN",
  "members.view": "TRAINER",
  "members.manage": "ADMIN",
  "audit.view": "ADMIN",
  "results.verify": "TRAINER",
  "range.duty": "TRAINER",
  "range.manage": "ADMIN",
  "weapons.loan": "TRAINER",
  "weapons.manage": "ADMIN",
  "shifts.manage": "ADMIN",
  "courses.manage": "TRAINER",
  "championship.manage": "ADMIN",
  "qualifications.manage": "ADMIN",
  "kiosk.sell": "TRAINER",
  "kiosk.manage": "ADMIN",
  "accounting.export": "ADMIN",
};

export type Actor = { isSuperAdmin: boolean; role: string | null };

export function can(actor: Actor, perm: Permission) {
  if (actor.isSuperAdmin) return true;
  return roleAtLeast(actor.role, PERMISSION_MIN_ROLE[perm]);
}
