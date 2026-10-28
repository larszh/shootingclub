import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Copy, Download, Pencil, Printer, Ruler, SlidersHorizontal } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getTarget } from "@/modules/targets/queries";
import { PRINT_LAYOUTS, categoryLabel, subjectCategory, subjectLabel, type TargetSubject } from "@/modules/targets/types";
import { allowedLayouts } from "@/modules/targets/print";
import { renderTarget } from "@/modules/targets/svg";
import { TargetPreview } from "@/modules/targets/ui/target-preview";
import { TargetFavoriteButton } from "@/modules/targets/ui/target-favorite";
import { TargetDeleteButton, TargetHiddenToggle } from "@/modules/targets/ui/target-controls";

export const metadata: Metadata = { title: "Scheibe" };

export default async function TargetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireModule("targets");
  const { id } = await params;
  const t = await getTarget(ctx, id);
  if (!t) notFound();
  const canManageTenant = ctx.can("tenant.targets.manage");
  const canEdit = t.scope === "mine" || (t.scope === "tenant" && !t.ownerUserId && canManageTenant) || (t.scope === "global" && ctx.user.isSuperAdmin);
  const editHref = t.scope === "global" ? `/super/targets/${t.id}/edit` : `/targets/${t.id}/edit`;
  const layouts = allowedLayouts(t.paperSizes, t.subject === "UPLOAD" && t.mimeType === "application/pdf");
  const note = t.subject === "UPLOAD" ? null : renderTarget(t.subject as TargetSubject, t.paperSizes[0] ?? "A4", t.params).note;

  return (
    <div>
      <PageHeader title={t.name} subtitle={t.description ?? undefined} back={{ href: "/targets", label: "Zielscheiben" }} action={<TargetFavoriteButton targetId={t.id} favorite={t.favorite} />} />
      <div className="animate-rise flex flex-wrap gap-1.5 mb-4">
        <Badge>{subjectLabel(t.subject)}</Badge>
        {t.subject !== "UPLOAD" ? <Badge tone="outline">{categoryLabel(subjectCategory(t.subject))}</Badge> : null}
        <Badge tone="accent">{t.scope === "global" ? "Global" : t.scope === "mine" ? "Meine" : "Verein"}</Badge>
        {t.hidden ? <Badge tone="warn">Versteckt</Badge> : null}
        {t.scope === "mine" && t.sharedWithTenant ? <Badge tone="ok">Geteilt</Badge> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <Card className="animate-rise overflow-hidden bg-white">
          <div className="aspect-[210/297] max-h-[70vh] mx-auto">
            <TargetPreview target={t} size={t.paperSizes[0]} className="h-full w-full" />
          </div>
        </Card>
        <div className="space-y-4">
          <div className="animate-rise [animation-delay:80ms]">
            <SectionTitle>Drucken</SectionTitle>
            <div className="grid gap-2">
              {t.paperSizes.map((s) => (
                <a key={s} href={`/targets/${t.id}/print?size=${s}&auto=1`} target="_blank" rel="noopener" className="press">
                  <Card className="p-3.5 flex items-center gap-3 hover:border-ink/30"><Printer className="h-5 w-5 text-ink-2" /><span className="font-medium flex-1">{s} drucken</span><span className="text-xs text-ink-3">sofort</span></Card>
                </a>
              ))}
              {layouts.filter((l) => l !== "single").map((l) => (
                <a key={l} href={`/targets/${t.id}/print?layout=${l}&auto=1`} target="_blank" rel="noopener" className="press">
                  <Card className="p-3.5 flex items-center gap-3 hover:border-ink/30"><Copy className="h-5 w-5 text-ink-2" /><span className="font-medium flex-1">{PRINT_LAYOUTS.find((x) => x.key === l)?.label}</span><span className="text-xs text-ink-3">mit Schnittlinien</span></Card>
                </a>
              ))}
              <a href={`/targets/${t.id}/print`} target="_blank" rel="noopener" className="press">
                <Card className="p-3.5 flex items-center gap-3 hover:border-ink/30"><SlidersHorizontal className="h-5 w-5 text-ink-2" /><span className="font-medium flex-1">Druckoptionen</span><span className="text-xs text-ink-3">Format, Anzahl</span></Card>
              </a>
            </div>
            <p className="mt-2 text-xs text-ink-3">Unten rechts wird klein Datum, dein Name und der Verein aufgedruckt. Im Druckdialog 100 % bzw. «Tatsächliche Grösse» wählen.</p>
            {note ? <p className="mt-2 text-xs text-ink-2"><Ruler className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />{note}</p> : null}
            {t.subject !== "UPLOAD" ? (
              <a href={`/api/targets/${t.id}/svg?size=${t.paperSizes[0] ?? "A4"}`} className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink"><Download className="h-4 w-4" /> Als SVG herunterladen</a>
            ) : null}
          </div>
          {canEdit || canManageTenant ? (
            <div className="animate-rise [animation-delay:140ms]">
              <SectionTitle>Verwaltung</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {canManageTenant && t.scope !== "mine" ? <TargetHiddenToggle targetId={t.id} hidden={t.hidden} /> : null}
                {canEdit ? <LinkButton href={editHref} variant="secondary"><Pencil className="h-4 w-4" /> Bearbeiten</LinkButton> : null}
                {canEdit ? <TargetDeleteButton targetId={t.id} /> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
