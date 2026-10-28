import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireModule } from "@/lib/tenant";
import { listConversations } from "@/modules/chat/queries";
import { syncClubGroupForUser } from "@/modules/chat/service";
import { ConversationList } from "@/modules/chat/ui/conversation-list";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatPage() {
  const ctx = await requireModule("chat");
  if (!ctx.tenant.role) {
    return (
      <>
        <PageHeader title="Chat" />
        <EmptyState icon={<MessageCircle className="h-6 w-6" />} title="Nur für Mitglieder" text="Der Chat ist nur für Mitglieder dieses Vereins sichtbar." />
      </>
    );
  }
  // Günstiger Abgleich: neue Mitglieder kommen in die synchronisierte Vereins-Gruppe.
  await syncClubGroupForUser(ctx.user.id, ctx.tenant.id);
  const items = await listConversations(ctx.user.id, ctx.tenant.id);
  return (
    <>
      <PageHeader title="Chat" subtitle={ctx.tenant.name} />
      <ConversationList userId={ctx.user.id} items={items} />
    </>
  );
}
