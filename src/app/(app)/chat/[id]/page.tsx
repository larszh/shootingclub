import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/tenant";
import { getRequestLocale, getT } from "@/lib/i18n";
import { getConversationDetail, listTenantMembersForPicker } from "@/modules/chat/queries";
import { ConversationView } from "@/modules/chat/ui/conversation-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("money.chat.title") };
}

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireModule("chat");
  if (!ctx.tenant.role) redirect("/chat");
  const { id } = await params;
  const detail = await getConversationDetail(ctx.user.id, ctx.tenant.id, id);
  // Kein Zugriff (nie Mitglied, entfernt, anderer Verein): zurück zur Übersicht.
  if (!detail) redirect("/chat");
  const isGroupAdmin = detail.kind === "GROUP" && detail.myRole === "ADMIN";
  const tenantMembers = isGroupAdmin ? await listTenantMembersForPicker(ctx.tenant.id, ctx.user.id) : [];
  return (
    <ConversationView
      key={detail.id}
      me={{ id: ctx.user.id, name: ctx.user.name, avatarUrl: ctx.user.avatarUrl }}
      detail={detail}
      tenantMembers={tenantMembers}
      canManageClub={ctx.can("tenant.manage")}
      locale={await getRequestLocale()}
    />
  );
}
