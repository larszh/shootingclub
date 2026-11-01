/**
 * Welche Mitgliedschafts-Status Zugang zum Verein geben (ohne Server-Abhängigkeiten, testbar).
 * LEFT = ausgetreten, PENDING = Beitritt wartet auf Freigabe (Tenant.joinApproval).
 * Beide zählen in getCurrentUser (src/lib/auth.ts) nicht als Mitgliedschaft, damit
 * getAppContext/requireTenant und alle API-Routen über user.memberships automatisch sperren.
 */
export const NO_ACCESS_STATUSES = ["LEFT", "PENDING"] as const;

export function hasTenantAccess(status: string | null | undefined): boolean {
  if (!status) return false;
  return !(NO_ACCESS_STATUSES as readonly string[]).includes(status);
}

/** Prisma-Filter für Membership.status mit Zugang. */
export function accessStatusWhere() {
  return { notIn: [...NO_ACCESS_STATUSES] as string[] };
}
