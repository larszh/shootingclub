import { LinkTabs } from "@/components/ui";

/** Unternavigation der Mitgliederverwaltung. Einladen, Haushalte und Import nur mit members.manage. */
export function MembersNav({ active, canManage, counts }: { active: "list" | "invitations" | "households" | "import"; canManage: boolean; counts?: { invitations?: number; households?: number } }) {
  const items = [
    { value: "list", href: "/admin/members", label: "Liste" },
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
