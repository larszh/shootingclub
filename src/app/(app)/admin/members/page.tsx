import type { Metadata } from "next";
import { requirePermission } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { userAvatarUrl } from "@/components/avatar";
import { AddMemberForm, MemberRow } from "./forms";

export const metadata: Metadata = { title: "Mitglieder" };

export default async function MembersPage() {
  const ctx = await requirePermission("tenant.manage");
  const members = await db.membership.findMany({ where: { tenantId: ctx.tenant.id }, include: { user: { select: { id: true, name: true, email: true, avatarPath: true, updatedAt: true } } }, orderBy: [{ role: "asc" }, { user: { name: "asc" } }] });
  const canSetOwner = ctx.user.isSuperAdmin || ctx.tenant.role === "OWNER";
  return (
    <div>
      <PageHeader title="Mitglieder" subtitle={`${members.length} in ${ctx.tenant.name}`} back={{ href: "/admin", label: "Einstellungen" }} action={<LinkButton href="/members" variant="secondary" size="sm">Verzeichnis</LinkButton>} />
      <SectionTitle>Hinzufügen</SectionTitle>
      <AddMemberForm />
      <SectionTitle>Alle</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {members.map((m) => (
          <MemberRow key={m.id} membershipId={m.id} name={m.user.name} email={m.user.email} role={m.role} isSelf={m.user.id === ctx.user.id} canSetOwner={canSetOwner} avatarUrl={userAvatarUrl(m.user)} />
        ))}
      </Card>
    </div>
  );
}
