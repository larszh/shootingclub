import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listTargets } from "@/modules/targets/queries";
import { TargetGallery, type GalleryFilters } from "@/modules/targets/ui/target-gallery";
import { TARGET_CATEGORIES } from "@/modules/targets/types";
import { getRequestLocale, getT } from "@/lib/i18n";
import { localizeTarget } from "@/modules/targets/target-i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.targets.title") };
}

type Search = { cat?: string; q?: string; scope?: string; fav?: string };

export default async function TargetsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireModule("targets");
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const initial: Partial<GalleryFilters> = {
    cat: TARGET_CATEGORIES.some((c) => c.key === sp.cat) ? (sp.cat as GalleryFilters["cat"]) : "all",
    q: typeof sp.q === "string" ? sp.q.slice(0, 100) : "",
    scope: ["global", "tenant", "mine"].includes(sp.scope ?? "") ? (sp.scope as GalleryFilters["scope"]) : "all",
    onlyFav: sp.fav === "1",
  };
  const targets = (await listTargets(ctx, { includeHidden: ctx.can("tenant.targets.manage") })).map((x) => localizeTarget(x, locale));
  return (
    <div>
      <PageHeader title={t("shooting.targets.title")} subtitle={t("shooting.targets.subtitle")} action={<LinkButton href="/targets/new" size="sm"><Plus className="h-4 w-4" /> {t("shooting.targets.own")}</LinkButton>} />
      {targets.length ? <TargetGallery targets={targets} initial={initial} /> : <EmptyState title={t("shooting.targets.none")} text={t("shooting.targets.noneText")} action={<LinkButton href="/targets/new" size="sm">{t("shooting.targets.create")}</LinkButton>} />}
    </div>
  );
}
