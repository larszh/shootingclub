import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Printer } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getTarget } from "@/modules/targets/queries";
import { subjectLabel } from "@/modules/targets/types";
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

  return (
    <div>
      <PageHeader title={t.name} subtitle={t.description ?? undefined} back={{ href: "/targets", label: "Zielscheiben" }} action={<TargetFavoriteButton targetId={t.id} favorite={t.favorite} />} />
      <div className="animate-rise flex flex-wrap gap-1.5 mb-4">
        <Badge>{subjectLabel(t.subject)}</Badge>
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
                <Link key={s} href={`/targets/${t.id}/print?size=${s}`} target="_blank" className="press">
                  <Card className="p-3.5 flex items-center gap-3 hover:border-ink/30"><Printer className="h-5 w-5 text-ink-2" /><span className="font-medium flex-1">{s} drucken</span><span className="text-xs text-ink-3">öffnet Druckansicht</span></Card>
                </Link>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-3">Unten rechts wird klein Datum, dein Name und der Verein aufgedruckt.</p>
          </div>
          {canEdit || canManageTenant ? (
            <div className="animate-rise [animation-delay:140ms]">
              <SectionTitle>Verwaltung</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {canManageTenant && t.scope !== "mine" ? <TargetHiddenToggle targetId={t.id} hidden={t.hidden} /> : null}
                {canEdit ? <LinkButton href={editHref} variant="secondary" size="sm"><Pencil className="h-4 w-4" /> Bearbeiten</LinkButton> : null}
                {canEdit ? <TargetDeleteButton targetId={t.id} /> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
