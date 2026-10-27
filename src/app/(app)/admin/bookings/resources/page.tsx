import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { AdminBookingTabs } from "@/modules/bookings/ui/admin-tabs";
import { listBlocks, listResources } from "@/modules/bookings/queries";
import { resourceKindLabel } from "@/modules/bookings/types";
import { BlockForm, DeleteBlockButton, ResourceRowActions } from "@/modules/bookings/ui/block-form";
import { formatDateTimeZurich, todayZurich } from "@/lib/time";

export const metadata = { title: "Ressourcen" };

export default async function ResourcesPage() {
  const ctx = await requirePermission("tenant.manage");
  const [resources, blocks] = await Promise.all([listResources(ctx.tenant.id, { includeInactive: true }), listBlocks(ctx.tenant.id)]);
  return (
    <div>
      <PageHeader title="Ressourcen" subtitle="Anlagen, Bahnen und Räume, die gebucht werden können" back={{ href: "/admin/bookings", label: "Reservationen" }}
        action={<LinkButton href="/admin/bookings/resources/new" size="sm"><Plus className="h-4 w-4" /> Neu</LinkButton>} />
      <AdminBookingTabs />
      {resources.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {resources.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium flex items-center gap-2">{r.name}{!r.isActive ? <Badge tone="warn">inaktiv</Badge> : null}{r.durationOptions ? <Badge tone="outline">eigene Preise</Badge> : null}</div>
                <div className="text-xs text-ink-3">{resourceKindLabel(r.kind)} · {r.capacity} {r.capacity === 1 ? "Platz" : "Plätze"}{r.description ? ` · ${r.description}` : ""}</div>
              </div>
              <Link href={`/admin/bookings/resources/${r.id}/edit`} className="h-9 w-9 rounded-full flex items-center justify-center text-ink-3 hover:bg-surface-2" aria-label="Bearbeiten"><Pencil className="h-4 w-4" /></Link>
              <ResourceRowActions id={r.id} isActive={r.isActive} />
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState title="Noch keine Ressourcen" text="Lege zum Beispiel «25 m Stand» mit 4 Plätzen oder «Bahn 1» an." action={<LinkButton href="/admin/bookings/resources/new" size="sm">Ressource anlegen</LinkButton>} />
      )}

      <SectionTitle>Sperrzeiten</SectionTitle>
      <BlockForm resources={resources.map((r) => ({ id: r.id, name: r.name }))} today={todayZurich()} />
      {blocks.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden mt-2.5">
          {blocks.map((b) => (
            <div key={b.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><div className="font-medium">{b.resource?.name ?? "Alle Ressourcen"}{b.reason ? <span className="text-ink-3 font-normal"> · {b.reason}</span> : null}</div><div className="text-xs text-ink-3">{formatDateTimeZurich(b.startsAt)} bis {formatDateTimeZurich(b.endsAt)}</div></div>
              <DeleteBlockButton id={b.id} />
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
