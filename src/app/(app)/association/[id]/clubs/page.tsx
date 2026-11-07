import type { Metadata } from "next";
import { formatDate } from "@/lib/utils";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { associationStatusLabel, canManageClubs, sharesAggregates } from "@/modules/association/access";
import { listAssociationMembers, requireAssociation } from "@/modules/association/queries";
import { AssociationTabs } from "../tabs";
import { PendingActions, RemoveClubButton } from "./forms";

export const metadata: Metadata = { title: "Vereine im Verband" };

export default async function AssociationClubsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAssociation(id);
  const manage = canManageClubs(ctx.access) && !ctx.association.deletedAt;
  // Gelöschte Vereine erscheinen nicht (weder Name noch Status).
  const members = (await listAssociationMembers(ctx.association.id)).filter((m) => !m.tenantDeletedAt);
  const pending = members.filter((m) => m.status === "PENDING");
  const active = members.filter((m) => m.status === "APPROVED");
  const revoked = members.filter((m) => m.status === "REVOKED");
  const place = (m: { city: string | null; canton: string | null }) => [m.city, m.canton].filter(Boolean).join(", ");

  return (
    <div>
      <PageHeader title="Vereine" subtitle={ctx.association.name} back={{ href: "/association", label: "Verband" }} />
      <AssociationTabs id={ctx.association.id} active="clubs" pending={pending.length} />

      <SectionTitle>Anfragen ({pending.length})</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {pending.map((m) => (
          <div key={m.id} className="px-4 py-3 space-y-3">
            <div>
              <div className="font-medium">{m.clubName}</div>
              <div className="text-xs text-ink-3">{place(m) ? `${place(m)} · ` : ""}angefragt am {formatDate(m.createdAt)} · {m.shareNames ? "mit Namen für Ranglisten" : "nur Zahlen"}</div>
            </div>
            {manage ? <PendingActions associationId={ctx.association.id} memberId={m.id} clubName={m.clubName} /> : null}
          </div>
        ))}
        {pending.length === 0 ? <p className="p-4 text-sm text-ink-3">Keine offenen Anfragen.</p> : null}
      </Card>

      <SectionTitle>Aktiv ({active.length})</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {active.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3 min-h-14">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{m.clubName}</div>
              <div className="text-xs text-ink-3 truncate">{place(m) ? `${place(m)} · ` : ""}{m.approvedAt ? `seit ${formatDate(m.approvedAt)}` : ""}</div>
            </div>
            {sharesAggregates(m) ? null : <Badge tone="warn">Keine Zustimmung</Badge>}
            <Badge tone={m.shareNames ? "ok" : "outline"}>{m.shareNames ? "Namen" : "Nur Zahlen"}</Badge>
            {manage ? <RemoveClubButton associationId={ctx.association.id} memberId={m.id} clubName={m.clubName} /> : null}
          </div>
        ))}
        {active.length === 0 ? <p className="p-4 text-sm text-ink-3">Noch keine aktiven Vereine.</p> : null}
      </Card>

      {revoked.length ? (
        <>
          <SectionTitle>Beendet ({revoked.length})</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {revoked.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 min-h-14">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{m.clubName}</div>
                  <div className="text-xs text-ink-3">{m.revokedAt ? `beendet am ${formatDate(m.revokedAt)}` : ""}</div>
                </div>
                <Badge tone="neutral">{associationStatusLabel(m.status)}</Badge>
              </div>
            ))}
          </Card>
        </>
      ) : null}
      <p className="mt-4 text-xs text-ink-3">Vereine treten mit dem Code <span className="font-mono">{ctx.association.code}</span> unter Einstellungen → Verband bei und können jederzeit austreten.</p>
    </div>
  );
}
