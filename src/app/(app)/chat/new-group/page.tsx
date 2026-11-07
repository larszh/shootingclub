import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireModule } from "@/lib/tenant";
import { getRequestLocale, getT } from "@/lib/i18n";
import { getClubGroupId, listTenantMembersForPicker } from "@/modules/chat/queries";
import { NewGroupForm } from "@/modules/chat/ui/new-group-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("money.chat.newGroup") };
}

export default async function NewGroupPage() {
  const ctx = await requireModule("chat");
  if (!ctx.tenant.role) redirect("/chat");
  const canCreateClub = ctx.can("tenant.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const [members, clubGroupId] = await Promise.all([listTenantMembersForPicker(ctx.tenant.id, ctx.user.id), canCreateClub ? getClubGroupId(ctx.tenant.id) : Promise.resolve(null)]);
  return (
    <>
      <PageHeader title={t("money.chat.newGroup")} subtitle={t("money.chat.newGroupSubtitle")} back={{ href: "/chat", label: t("money.chat.title") }} />
      <NewGroupForm members={members} canCreateClub={canCreateClub} clubGroupExists={!!clubGroupId} locale={locale} />
    </>
  );
}
