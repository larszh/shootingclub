import { LinkTabs } from "@/components/ui";
import { db } from "@/lib/db";
import { getRequestLocale, getT } from "@/lib/i18n";

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
  const t = getT(await getRequestLocale());
  const items = [
    { value: "list", href: "/admin/members", label: t("adm1.members.tab.list") },
    ...(canApprove ? [{ value: "requests", href: "/admin/members/requests", label: t("adm1.members.tab.requests"), count: requests || undefined }] : []),
    ...(canManage
      ? [
          { value: "invitations", href: "/admin/members/invitations", label: t("adm1.members.tab.invite"), count: counts?.invitations || undefined },
          { value: "households", href: "/admin/members/households", label: t("adm1.members.tab.households"), count: counts?.households || undefined },
          { value: "import", href: "/admin/members/import", label: t("adm1.members.tab.import") },
        ]
      : []),
  ];
  if (items.length < 2) return null;
  return <LinkTabs items={items} active={active} label={t("adm1.members.tab.label")} className="mb-4" />;
}
