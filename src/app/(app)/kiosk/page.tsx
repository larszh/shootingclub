import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Settings2, UserRound } from "lucide-react";
import { Alert, LinkButton, PageHeader } from "@/components/ui";
import { userAvatarUrl } from "@/components/avatar";
import { requireKiosk } from "@/modules/kiosk/guard";
import { counterMembers, listProducts, recentSellerBatches } from "@/modules/kiosk/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { KioskCounter, type KioskCounterMember, type KioskRecentBatch } from "@/modules/kiosk/ui/counter";

export const metadata: Metadata = { title: "Schützenstube" };

/** Theke der Schützenstube (kiosk.sell); alle anderen sehen ihre eigenen Konsumationen. */
export default async function KioskPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const ctx = await requireKiosk();
  const sp = await searchParams;
  if (!ctx.can("kiosk.sell")) redirect("/kiosk/me");
  const tenantId = ctx.tenant.id;
  const [{ members, recentIds }, products, recent, profile] = await Promise.all([
    counterMembers(tenantId),
    listProducts(tenantId, { activeOnly: true }),
    recentSellerBatches(tenantId, ctx.user.id),
    getBillingProfile(tenantId, ctx.tenant.name),
  ]);
  const memberList: KioskCounterMember[] = members.map((m) => ({ userId: m.user.id, name: m.user.name, memberNumber: m.memberNumber, avatarUrl: userAvatarUrl(m.user) }));
  const recentList: KioskRecentBatch[] = recent.map((b) => ({ batchId: b.batchId, who: b.who, paidCash: b.paidCash, createdAtMs: b.createdAt.getTime(), totalCents: b.totalCents, billed: b.billed, items: b.items }));

  return (
    <div>
      <PageHeader
        title="Schützenstube"
        subtitle="Konsumationen aufschreiben"
        action={
          <div className="flex gap-2">
            <LinkButton href="/kiosk/me" variant="secondary" aria-label="Meine Konsumationen"><UserRound className="h-4 w-4" /> <span className="hidden sm:inline">Meine</span></LinkButton>
            {ctx.can("kiosk.manage") ? <LinkButton href="/admin/kiosk" variant="secondary" aria-label="Schützenstube verwalten"><Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Verwalten</span></LinkButton> : null}
          </div>
        }
      />
      {sp.denied ? <Alert className="mb-4">Dafür fehlt dir die Berechtigung.</Alert> : null}
      <KioskCounter tenantId={tenantId} members={memberList} recentIds={recentIds} products={products} recent={recentList} currency={profile.currency} />
    </div>
  );
}
