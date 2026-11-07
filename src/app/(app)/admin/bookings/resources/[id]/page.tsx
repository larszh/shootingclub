import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getResource } from "@/modules/bookings/queries";
import { resourceKindLabelT } from "@/modules/bookings/i18n";
import { getRequestLocale, getT } from "@/lib/i18n";
import { ResourceIcon } from "@/modules/bookings/ui/resource-icon";
import { listResourceShares } from "@/modules/sharing/queries";
import { ShareForm, ShareList } from "@/modules/sharing/ui/share-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.bk.resource") };
}

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  const { id } = await params;
  const t = getT(await getRequestLocale());
  const resource = await getResource(ctx.tenant.id, id);
  if (!resource) notFound();
  const shares = await listResourceShares(ctx.tenant.id, resource.id);
  return (
    <div>
      <PageHeader title={resource.name} subtitle={resourceKindLabelT(resource.kind, t)} back={{ href: "/admin/bookings/resources", label: t("adm1.bk.resources") }}
        action={<LinkButton href={`/admin/bookings/resources/${resource.id}/edit`} variant="secondary" size="sm"><Pencil className="h-4 w-4" /> {t("adm1.common.edit")}</LinkButton>} />

      <Card className="animate-rise flex items-center gap-3 p-4">
        <ResourceIcon kind={resource.kind} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-medium flex items-center gap-2">{resource.name}{!resource.isActive ? <Badge tone="warn">{t("adm1.bk.inactive")}</Badge> : null}</div>
          <div className="text-xs text-ink-3">{t(resource.capacity === 1 ? "bookings.places.one" : "bookings.places.many", { count: resource.capacity })}{resource.maxPersons ? ` · ${t("adm1.bk.maxPersons", { n: resource.maxPersons })}` : ""}{resource.description ? ` · ${resource.description}` : ""}</div>
        </div>
      </Card>

      <SectionTitle>{t("adm1.bk.shareTitle")}</SectionTitle>
      <p className="mb-3 text-sm text-ink-3">
        {t("adm1.bk.shareText")}
      </p>
      <ShareForm resourceId={resource.id} />

      <SectionTitle>{t("adm1.bk.sharedWith")}</SectionTitle>
      <ShareList shares={shares.map((s) => ({ id: s.id, partnerName: s.guestTenant.name, partnerSlug: s.guestTenant.slug, city: s.guestTenant.city, canBook: s.canBook, priceFactorPercent: s.priceFactorPercent, note: s.note, deleted: !!s.guestTenant.deletedAt }))} />
    </div>
  );
}
