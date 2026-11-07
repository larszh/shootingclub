import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireModule } from "@/lib/tenant";
import { getRequestLocale, getT } from "@/lib/i18n";
import { listConversations } from "@/modules/chat/queries";
import { syncClubGroupForUser } from "@/modules/chat/service";
import { ConversationList } from "@/modules/chat/ui/conversation-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("money.chat.title") };
}

export default async function ChatPage() {
  const ctx = await requireModule("chat");
  const locale = await getRequestLocale();
  const t = getT(locale);
  if (!ctx.tenant.role) {
    return (
      <>
        <PageHeader title={t("money.chat.title")} />
        <EmptyState icon={<MessageCircle className="h-6 w-6" />} title={t("money.chat.membersOnly.title")} text={t("money.chat.membersOnly.text")} />
      </>
    );
  }
  // Günstiger Abgleich: neue Mitglieder kommen in die synchronisierte Vereins-Gruppe.
  await syncClubGroupForUser(ctx.user.id, ctx.tenant.id);
  const items = await listConversations(ctx.user.id, ctx.tenant.id);
  return (
    <>
      <PageHeader title={t("money.chat.title")} subtitle={ctx.tenant.name} />
      <ConversationList userId={ctx.user.id} items={items} locale={locale} />
    </>
  );
}
