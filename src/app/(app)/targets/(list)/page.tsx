import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listTargets } from "@/modules/targets/queries";
import { TargetGallery, type GalleryFilters } from "@/modules/targets/ui/target-gallery";
import { TARGET_CATEGORIES } from "@/modules/targets/types";

export const metadata: Metadata = { title: "Zielscheiben" };

type Search = { cat?: string; q?: string; scope?: string; fav?: string };

export default async function TargetsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireModule("targets");
  const sp = await searchParams;
  const initial: Partial<GalleryFilters> = {
    cat: TARGET_CATEGORIES.some((c) => c.key === sp.cat) ? (sp.cat as GalleryFilters["cat"]) : "all",
    q: typeof sp.q === "string" ? sp.q.slice(0, 100) : "",
    scope: ["global", "tenant", "mine"].includes(sp.scope ?? "") ? (sp.scope as GalleryFilters["scope"]) : "all",
    onlyFav: sp.fav === "1",
  };
  const targets = await listTargets(ctx, { includeHidden: ctx.can("tenant.targets.manage") });
  return (
    <div>
      <PageHeader title="Zielscheiben" subtitle="Druckvorlagen in A4, A5 und A6" action={<LinkButton href="/targets/new" size="sm"><Plus className="h-4 w-4" /> Eigene</LinkButton>} />
      {targets.length ? <TargetGallery targets={targets} initial={initial} /> : <EmptyState title="Keine Scheiben" text="Lade ein eigenes Sujet hoch." action={<LinkButton href="/targets/new" size="sm">Scheibe anlegen</LinkButton>} />}
    </div>
  );
}
