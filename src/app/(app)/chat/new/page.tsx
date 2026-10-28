import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireModule } from "@/lib/tenant";
import { listTenantMembersForPicker } from "@/modules/chat/queries";
import { NewDirectPicker } from "@/modules/chat/ui/new-direct";

export const metadata: Metadata = { title: "Neue Nachricht" };

export default async function NewChatPage() {
  const ctx = await requireModule("chat");
  if (!ctx.tenant.role) redirect("/chat");
  const members = await listTenantMembersForPicker(ctx.tenant.id, ctx.user.id);
  return (
    <>
      <PageHeader title="Neue Nachricht" subtitle="Wem möchtest du schreiben?" back={{ href: "/chat", label: "Chat" }} />
      <NewDirectPicker members={members} />
    </>
  );
}
