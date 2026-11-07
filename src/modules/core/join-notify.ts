import "server-only";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { TENANT_ROLES, can } from "@/lib/permissions";
import { accessStatusWhere } from "@/lib/membership-access";

/** Rollen mit dem Recht, Beitrittsgesuche zu entscheiden («members.approve»). */
export function approverRoles(): string[] {
  return TENANT_ROLES.filter((role) => can({ isSuperAdmin: false, role }, "members.approve"));
}

/**
 * Neue Beitrittsanfrage (Membership PENDING): Protokoll und Mitteilung an alle, die freigeben dürfen.
 * Wirft nie (notify fängt Fehler ab).
 */
export async function announceJoinRequest(tenantId: string, membershipId: string, user: { id: string; name: string; email: string }) {
  await audit({ tenantId, actorId: user.id, actorName: user.name, action: "member.join.request", entity: "Membership", entityId: membershipId, detail: `${user.name} <${user.email}>` });
  const approvers = await db.membership.findMany({
    where: { tenantId, role: { in: approverRoles() }, status: accessStatusWhere(), user: { deletedAt: null } },
    select: { userId: true },
  });
  const ids = approvers.map((a) => a.userId).filter((id) => id !== user.id);
  if (!ids.length) return;
  await notify({
    tenantId,
    userIds: ids,
    topic: "system",
    title: "Neue Beitrittsanfrage",
    body: `${user.name} möchte dem Verein beitreten.`,
    url: "/admin/members/requests",
    tag: `join:${membershipId}`,
    i18n: { title: "bookings.join.notify.request.title", body: "bookings.join.notify.request.body", vars: { name: user.name } },
    dedupeKey: `join-request:${membershipId}`,
  });
}
