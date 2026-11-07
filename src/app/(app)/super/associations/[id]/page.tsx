import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import { Alert, Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getAssociationForSuper, listAssociationMembers } from "@/modules/association/queries";
import { associationStatusLabel, associationStatusTone } from "@/modules/association/access";
import { AddAdminForm, AdminRow, CodeCard, DeleteAssociationButton, EditAssociationForm } from "./forms";

export const metadata: Metadata = { title: "Verband" };

export default async function SuperAssociationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const a = await getAssociationForSuper(id);
  if (!a) notFound();
  const members = await listAssociationMembers(a.id);

  return (
    <div>
      <PageHeader
        title={a.name}
        subtitle={`${a.region ? `${a.region} · ` : ""}seit ${formatDate(a.createdAt)}`}
        back={{ href: "/super/associations", label: "Verbände" }}
        action={a.deletedAt ? undefined : <LinkButton href={`/association/${a.id}`} variant="secondary">Verbandsbereich</LinkButton>}
      />
      {a.deletedAt ? <Alert tone="warn" className="mb-4">Gelöscht am {formatDate(a.deletedAt)}. Der Verbandsbereich ist gesperrt.</Alert> : null}

      <SectionTitle>Beitrittscode</SectionTitle>
      <CodeCard id={a.id} code={a.code} />

      <SectionTitle>Angaben</SectionTitle>
      <EditAssociationForm id={a.id} name={a.name} region={a.region} />

      <SectionTitle>Zugänge ({a.admins.length})</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {a.admins.map((ad) => (
          <AdminRow key={ad.id} id={ad.id} name={ad.user.name} email={ad.user.email} role={ad.role} deleted={!!ad.user.deletedAt} />
        ))}
        {a.admins.length === 0 ? <p className="p-4 text-sm text-ink-3">Noch niemand hat Zugang. Super-Admins sehen den Verbandsbereich immer.</p> : null}
      </Card>
      <div className="mt-2.5"><AddAdminForm associationId={a.id} /></div>
      <p className="mt-2 text-xs text-ink-3">«Verbandsadmin» gibt Vereine frei und entfernt sie, «Nur lesen» sieht nur die Auswertungen.</p>

      <SectionTitle>Vereine ({members.length})</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3 min-h-14">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{m.clubName}</div>
              <div className="text-xs text-ink-3 truncate">
                {m.status === "APPROVED" && m.approvedAt ? `seit ${formatDate(m.approvedAt)}` : m.status === "PENDING" ? `angefragt ${formatDate(m.createdAt)}` : m.revokedAt ? `beendet ${formatDate(m.revokedAt)}` : ""}
                {m.shareNames && m.status === "APPROVED" ? " · Namen freigegeben" : ""}
              </div>
            </div>
            {m.tenantDeletedAt ? <Badge tone="danger">Verein gelöscht</Badge> : null}
            <Badge tone={associationStatusTone(m.status)}>{associationStatusLabel(m.status)}</Badge>
          </div>
        ))}
        {members.length === 0 ? <p className="p-4 text-sm text-ink-3">Noch keine Vereine.</p> : null}
      </Card>

      <SectionTitle>Löschen</SectionTitle>
      <DeleteAssociationButton id={a.id} name={a.name} deleted={!!a.deletedAt} />
    </div>
  );
}
