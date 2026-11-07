import type { Metadata } from "next";
import { Home } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { db } from "@/lib/db";
import { accessStatusWhere } from "@/lib/membership-access";
import { getRequestLocale, getT } from "@/lib/i18n";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { userAvatarUrl } from "@/components/avatar";
import { listHouseholds } from "@/modules/members/queries";
import { MembersNav } from "../nav";
import { CreateHouseholdForm, HouseholdCard, type HouseholdView } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.home.households") };
}

export default async function HouseholdsPage() {
  const ctx = await requirePermission("members.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const [households, members] = await Promise.all([
    listHouseholds(ctx.tenant.id),
    db.membership.findMany({
      where: { tenantId: ctx.tenant.id, status: accessStatusWhere() },
      orderBy: { user: { name: "asc" } },
      select: { id: true, householdId: true, user: { select: { name: true } } },
    }),
  ]);
  const views: HouseholdView[] = households.map((h) => ({
    id: h.id,
    name: h.name,
    payerUserId: h.payerUserId,
    members: h.memberships.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      name: m.user.name,
      avatarUrl: userAvatarUrl(m.user),
      left: m.status === "LEFT",
      feeCents: m.feeAmountOverrideCents ?? m.feeCategory?.amountCents ?? 0,
    })),
  }));
  const options = members.map((m) => ({ id: m.id, name: m.user.name, householdId: m.householdId }));

  return (
    <div>
      <PageHeader title={t("adm1.home.households")} subtitle={t("adm1.hh.subtitle")} back={{ href: "/admin/members", label: t("adm1.members.title") }} />
      <MembersNav active="households" canApprove={ctx.can("members.approve")} tenantId={ctx.tenant.id} canManage counts={{ households: households.length }} />

      <SectionTitle>{t("adm1.hh.new")}</SectionTitle>
      <CreateHouseholdForm locale={locale} members={options} />

      <SectionTitle>{households.length ? t(households.length === 1 ? "adm1.hh.count.one" : "adm1.hh.count.other", { n: households.length }) : t("adm1.home.households")}</SectionTitle>
      {views.length ? (
        <div className="space-y-2.5">
          {views.map((h) => <HouseholdCard key={h.id} locale={locale} household={h} candidates={options.filter((o) => o.householdId !== h.id)} />)}
        </div>
      ) : (
        <EmptyState icon={<Home className="h-5 w-5" />} title={t("adm1.hh.emptyTitle")} text={t("adm1.hh.emptyText")} />
      )}
    </div>
  );
}
