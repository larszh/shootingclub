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
  | "announcements.manage"; // Mitteilungen an alle erfassen

const PERMISSION_MIN_ROLE: Record<Permission, TenantRole> = {
  "tenant.manage": "ADMIN",
  "tenant.programs.manage": "ADMIN",
  "tenant.targets.manage": "ADMIN",
  "match.viewAll": "TRAINER",
  "match.create": "MEMBER",
  "match.delete": "ADMIN",
  "events.manage": "TRAINER",
  "announcements.manage": "ADMIN",
};

export type Actor = { isSuperAdmin: boolean; role: string | null };

export function can(actor: Actor, perm: Permission) {
  if (actor.isSuperAdmin) return true;
  return roleAtLeast(actor.role, PERMISSION_MIN_ROLE[perm]);
}
