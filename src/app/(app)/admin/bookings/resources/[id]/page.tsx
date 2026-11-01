import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getResource } from "@/modules/bookings/queries";
import { resourceKindLabel } from "@/modules/bookings/types";
import { ResourceIcon } from "@/modules/bookings/ui/resource-icon";
import { listResourceShares } from "@/modules/sharing/queries";
import { ShareForm, ShareList } from "@/modules/sharing/ui/share-form";

export const metadata: Metadata = { title: "Ressource" };

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  const { id } = await params;
  const resource = await getResource(ctx.tenant.id, id);
  if (!resource) notFound();
  const shares = await listResourceShares(ctx.tenant.id, resource.id);
  return (
    <div>
      <PageHeader title={resource.name} subtitle={resourceKindLabel(resource.kind)} back={{ href: "/admin/bookings/resources", label: "Ressourcen" }}
        action={<LinkButton href={`/admin/bookings/resources/${resource.id}/edit`} variant="secondary" size="sm"><Pencil className="h-4 w-4" /> Bearbeiten</LinkButton>} />

      <Card className="animate-rise flex items-center gap-3 p-4">
        <ResourceIcon kind={resource.kind} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-medium flex items-center gap-2">{resource.name}{!resource.isActive ? <Badge tone="warn">inaktiv</Badge> : null}</div>
          <div className="text-xs text-ink-3">{resource.capacity} {resource.capacity === 1 ? "Platz" : "Plätze"}{resource.maxPersons ? ` · max. ${resource.maxPersons} Pers.` : ""}{resource.description ? ` · ${resource.description}` : ""}</div>
        </div>
      </Card>

      <SectionTitle>Mit Partnerverein teilen</SectionTitle>
      <p className="mb-3 text-sm text-ink-3">
        Mitglieder des Partnervereins sehen diese Anlage unter «Reservationen» und buchen sie nach euren Regeln (Öffnungszeiten, Vorlauf, Freigabe, Schiesszeiten).
        Die Buchungen erscheinen bei euch mit Abzeichen, die Rechnung stellt ihr. Partner sehen nur freie Zeiten und ihre eigenen Buchungen, sonst nichts von eurem Verein.
      </p>
      <ShareForm resourceId={resource.id} />

      <SectionTitle>Geteilt mit</SectionTitle>
      <ShareList shares={shares.map((s) => ({ id: s.id, partnerName: s.guestTenant.name, partnerSlug: s.guestTenant.slug, city: s.guestTenant.city, canBook: s.canBook, priceFactorPercent: s.priceFactorPercent, note: s.note, deleted: !!s.guestTenant.deletedAt }))} />
    </div>
  );
}
