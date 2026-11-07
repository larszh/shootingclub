import { LinkTabs } from "@/components/ui";
import { db } from "@/lib/db";

type Active = "list" | "invitations" | "households" | "import" | "requests";

/**
 * Unternavigation der Mitgliederverwaltung. Einladen, Haushalte und Import nur mit members.manage,
 * «Anfragen» (Beitritt mit Freigabe) mit members.approve; der Zähler zeigt offene Anfragen.
 */
export async function MembersNav({ active, canManage, canApprove = false, tenantId, counts }: {
  active: Active;
  canManage: boolean;
  /** members.approve: Tab «Anfragen» mit Zähler offener Beitrittsanfragen */
  canApprove?: boolean;
  tenantId?: string;
  counts?: { invitations?: number; households?: number };
}) {
  const requests = canApprove && tenantId ? await db.membership.count({ where: { tenantId, status: "PENDING", user: { deletedAt: null } } }) : 0;
  const items = [
    { value: "list", href: "/admin/members", label: "Liste" },
    ...(canApprove ? [{ value: "requests", href: "/admin/members/requests", label: "Anfragen", count: requests || undefined }] : []),
    ...(canManage
      ? [
          { value: "invitations", href: "/admin/members/invitations", label: "Einladen", count: counts?.invitations || undefined },
          { value: "households", href: "/admin/members/households", label: "Haushalte", count: counts?.households || undefined },
          { value: "import", href: "/admin/members/import", label: "Import" },
        ]
      : []),
  ];
  if (items.length < 2) return null;
  return <LinkTabs items={items} active={active} label="Mitgliederverwaltung" className="mb-4" />;
}
