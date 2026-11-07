import type { Metadata } from "next";
import { requireModule } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { TargetForm } from "@/modules/targets/ui/target-form";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("misc.targets.newMeta") };
}

export default async function NewTargetPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const ctx = await requireModule("targets");
  const { scope } = await searchParams;
  const asTenant = scope === "tenant" && ctx.can("tenant.targets.manage");
  const t = getT(await getRequestLocale());
  return (
    <div>
      <PageHeader title={t(asTenant ? "misc.targets.newTenant" : "misc.targets.newOwn")} subtitle={t(asTenant ? "misc.targets.newTenantSub" : "misc.targets.newOwnSub")} back={{ href: "/targets", label: t("shooting.targets.title") }} />
      <TargetForm scope={asTenant ? "tenant" : "mine"} />
    </div>
  );
}
