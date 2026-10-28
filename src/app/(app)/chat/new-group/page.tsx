import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireModule } from "@/lib/tenant";
import { getClubGroupId, listTenantMembersForPicker } from "@/modules/chat/queries";
import { NewGroupForm } from "@/modules/chat/ui/new-group-form";

export const metadata: Metadata = { title: "Neue Gruppe" };

export default async function NewGroupPage() {
  const ctx = await requireModule("chat");
  if (!ctx.tenant.role) redirect("/chat");
  const canCreateClub = ctx.can("tenant.manage");
  const [members, clubGroupId] = await Promise.all([listTenantMembersForPicker(ctx.tenant.id, ctx.user.id), canCreateClub ? getClubGroupId(ctx.tenant.id) : Promise.resolve(null)]);
  return (
    <>
      <PageHeader title="Neue Gruppe" subtitle="Du wirst Admin der Gruppe." back={{ href: "/chat", label: "Chat" }} />
      <NewGroupForm members={members} canCreateClub={canCreateClub} clubGroupExists={!!clubGroupId} />
    </>
  );
}
