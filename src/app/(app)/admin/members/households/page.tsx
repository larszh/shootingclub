import type { Metadata } from "next";
import { Home } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { db } from "@/lib/db";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { userAvatarUrl } from "@/components/avatar";
import { listHouseholds } from "@/modules/members/queries";
import { MembersNav } from "../nav";
import { CreateHouseholdForm, HouseholdCard, type HouseholdView } from "./forms";

export const metadata: Metadata = { title: "Haushalte" };

export default async function HouseholdsPage() {
  const ctx = await requirePermission("members.manage");
  const [households, members] = await Promise.all([
    listHouseholds(ctx.tenant.id),
    db.membership.findMany({
      where: { tenantId: ctx.tenant.id, status: { not: "LEFT" } },
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
      <PageHeader title="Haushalte" subtitle="Familien erhalten eine gemeinsame Beitragsrechnung" back={{ href: "/admin/members", label: "Mitglieder" }} />
      <MembersNav active="households" canManage counts={{ households: households.length }} />

      <SectionTitle>Neuer Haushalt</SectionTitle>
      <CreateHouseholdForm members={options} />

      <SectionTitle>{households.length ? `${households.length} ${households.length === 1 ? "Haushalt" : "Haushalte"}` : "Haushalte"}</SectionTitle>
      {views.length ? (
        <div className="space-y-2.5">
          {views.map((h) => <HouseholdCard key={h.id} household={h} candidates={options.filter((o) => o.householdId !== h.id)} />)}
        </div>
      ) : (
        <EmptyState icon={<Home className="h-5 w-5" />} title="Noch keine Haushalte" text="Fasse Familienmitglieder zusammen. Beim Jahreslauf erhält die zahlende Person eine Rechnung für alle." />
      )}
    </div>
  );
}
