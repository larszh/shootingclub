import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { userAvatarUrl } from "@/components/avatar";
import { UserRow } from "./forms";

export const metadata: Metadata = { title: "Benutzer" };

export default async function SuperUsersPage() {
  const me = await requireSuperAdmin();
  const users = await db.user.findMany({ include: { memberships: { include: { tenant: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 500 });
  return (
    <div>
      <PageHeader title="Benutzer" subtitle={`${users.length} Konten`} back={{ href: "/super", label: "Verwaltung" }} />
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {users.map((u) => <UserRow key={u.id} id={u.id} name={u.name} email={u.email} isSuperAdmin={u.isSuperAdmin} isSelf={u.id === me.id} tenants={u.memberships.map((m) => m.tenant.name)} avatarUrl={userAvatarUrl(u)} />)}
      </Card>
    </div>
  );
}
