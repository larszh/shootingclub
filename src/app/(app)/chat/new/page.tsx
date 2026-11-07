import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireModule } from "@/lib/tenant";
import { getRequestLocale, getT } from "@/lib/i18n";
import { listTenantMembersForPicker } from "@/modules/chat/queries";
import { NewDirectPicker } from "@/modules/chat/ui/new-direct";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("money.chat.newMessage") };
}

export default async function NewChatPage() {
  const ctx = await requireModule("chat");
  if (!ctx.tenant.role) redirect("/chat");
  const members = await listTenantMembersForPicker(ctx.tenant.id, ctx.user.id);
  const locale = await getRequestLocale();
  const t = getT(locale);
  return (
    <>
      <PageHeader title={t("money.chat.newMessage")} subtitle={t("money.chat.newDirectSubtitle")} back={{ href: "/chat", label: t("money.chat.title") }} />
      <NewDirectPicker members={members} locale={locale} />
    </>
  );
}
