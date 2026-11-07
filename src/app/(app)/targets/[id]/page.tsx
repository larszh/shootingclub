import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Copy, Download, Pencil, Printer, Ruler, SlidersHorizontal } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getTarget } from "@/modules/targets/queries";
import { PRINT_LAYOUTS, subjectCategory, type TargetSubject } from "@/modules/targets/types";
import { getRequestLocale, getT } from "@/lib/i18n";
import { targetCategoryText, targetSubjectText, tOr } from "@/modules/scores/ui/labels";
import { allowedLayouts } from "@/modules/targets/print";
import { renderTarget } from "@/modules/targets/svg";
import { TargetPreview } from "@/modules/targets/ui/target-preview";
import { TargetFavoriteButton } from "@/modules/targets/ui/target-favorite";
import { TargetDeleteButton, TargetHiddenToggle } from "@/modules/targets/ui/target-controls";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.targets.target") };
}

export default async function TargetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireModule("targets");
  const { id } = await params;
  const t = await getTarget(ctx, id);
  if (!t) notFound();
  const locale = await getRequestLocale();
  const tr = getT(locale);
  const canManageTenant = ctx.can("tenant.targets.manage");
  const canEdit = t.scope === "mine" || (t.scope === "tenant" && !t.ownerUserId && canManageTenant) || (t.scope === "global" && ctx.user.isSuperAdmin);
  const editHref = t.scope === "global" ? `/super/targets/${t.id}/edit` : `/targets/${t.id}/edit`;
  const layouts = allowedLayouts(t.paperSizes, t.subject === "UPLOAD" && t.mimeType === "application/pdf");
  const note = t.subject === "UPLOAD" ? null : renderTarget(t.subject as TargetSubject, t.paperSizes[0] ?? "A4", t.params, locale).note;

  return (
    <div>
      <PageHeader title={t.name} subtitle={t.description ?? undefined} back={{ href: "/targets", label: tr("shooting.targets.title") }} action={<TargetFavoriteButton targetId={t.id} favorite={t.favorite} />} />
      <div className="animate-rise flex flex-wrap gap-1.5 mb-4">
        <Badge>{targetSubjectText(tr, t.subject)}</Badge>
        {t.subject !== "UPLOAD" ? <Badge tone="outline">{targetCategoryText(tr, subjectCategory(t.subject))}</Badge> : null}
        <Badge tone="accent">{t.scope === "global" ? tr("shooting.targets.scope.global") : t.scope === "mine" ? tr("shooting.targets.scope.mine") : tr("shooting.targets.scope.tenant")}</Badge>
        {t.hidden ? <Badge tone="warn">{tr("shooting.targets.hidden")}</Badge> : null}
        {t.scope === "mine" && t.sharedWithTenant ? <Badge tone="ok">{tr("shooting.targets.shared")}</Badge> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <Card className="animate-rise overflow-hidden bg-white">
          <div className="aspect-[210/297] max-h-[70vh] mx-auto">
            <TargetPreview target={t} size={t.paperSizes[0]} className="h-full w-full" locale={locale} />
          </div>
        </Card>
        <div className="space-y-4">
          <div className="animate-rise [animation-delay:80ms]">
            <SectionTitle>{tr("shooting.targets.print")}</SectionTitle>
            <div className="grid gap-2">
              {t.paperSizes.map((s) => (
                <a key={s} href={`/targets/${t.id}/print?size=${s}&auto=1`} target="_blank" rel="noopener" className="press">
                  <Card className="p-3.5 flex items-center gap-3 hover:border-ink/30"><Printer className="h-5 w-5 text-ink-2" /><span className="font-medium flex-1">{tr("shooting.targets.printSize", { size: s })}</span><span className="text-xs text-ink-3">{tr("shooting.targets.instant")}</span></Card>
                </a>
              ))}
              {layouts.filter((l) => l !== "single").map((l) => (
                <a key={l} href={`/targets/${t.id}/print?layout=${l}&auto=1`} target="_blank" rel="noopener" className="press">
                  <Card className="p-3.5 flex items-center gap-3 hover:border-ink/30"><Copy className="h-5 w-5 text-ink-2" /><span className="font-medium flex-1">{tOr(tr, `shooting.targets.layout.${l}`, PRINT_LAYOUTS.find((x) => x.key === l)?.label ?? l)}</span><span className="text-xs text-ink-3">{tr("shooting.targets.cutLines")}</span></Card>
                </a>
              ))}
              <a href={`/targets/${t.id}/print`} target="_blank" rel="noopener" className="press">
                <Card className="p-3.5 flex items-center gap-3 hover:border-ink/30"><SlidersHorizontal className="h-5 w-5 text-ink-2" /><span className="font-medium flex-1">{tr("shooting.targets.printOptions")}</span><span className="text-xs text-ink-3">{tr("shooting.targets.printOptionsHint")}</span></Card>
              </a>
            </div>
            <p className="mt-2 text-xs text-ink-3">{tr("shooting.targets.printNote")}</p>
            {note ? <p className="mt-2 text-xs text-ink-2"><Ruler className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />{note}</p> : null}
            {t.subject !== "UPLOAD" ? (
              <a href={`/api/targets/${t.id}/svg?size=${t.paperSizes[0] ?? "A4"}`} className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink"><Download className="h-4 w-4" /> {tr("shooting.targets.svg")}</a>
            ) : null}
          </div>
          {canEdit || canManageTenant ? (
            <div className="animate-rise [animation-delay:140ms]">
              <SectionTitle>{tr("shooting.targets.manage")}</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {canManageTenant && t.scope !== "mine" ? <TargetHiddenToggle targetId={t.id} hidden={t.hidden} /> : null}
                {canEdit ? <LinkButton href={editHref} variant="secondary"><Pencil className="h-4 w-4" /> {tr("shooting.targets.edit")}</LinkButton> : null}
                {canEdit ? <TargetDeleteButton targetId={t.id} /> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
