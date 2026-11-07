import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { listClubAssociations } from "@/modules/association/queries";
import { associationStatusLabel, associationStatusTone } from "@/modules/association/access";
import { JoinAssociationForm, LeaveButton, ShareNamesSwitch } from "./forms";

export const metadata: Metadata = { title: "Verband" };

export default async function AdminAssociationPage() {
  const ctx = await requirePermission("tenant.manage");
  const links = await listClubAssociations(ctx.tenant.id);
  const current = links.filter((l) => l.status !== "REVOKED");
  const past = links.filter((l) => l.status === "REVOKED");

  return (
    <div>
      <PageHeader title="Verband" subtitle="Kantonal- oder Regionalverband" back={{ href: "/admin", label: "Einstellungen" }} />
      <p className="mb-4 text-sm text-ink-2">
        Mit dem Code eures Verbands könnt ihr ihm Kennzahlen eures Vereins freigeben, z.B. für die Obligatorisch-Statistik oder Verbandsranglisten.
        Der Verband sieht nie Kontaktdaten, Rechnungen, Chat oder Dateien.
      </p>

      {current.length ? (
        <>
          <SectionTitle>Verbunden</SectionTitle>
          <div className="space-y-2.5">
            {current.map((l) => (
              <Card key={l.id} className="animate-rise p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-ink-2" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{l.association.name}</div>
                    <div className="text-xs text-ink-3">
                      {l.association.region ? `${l.association.region} · ` : ""}
                      {l.status === "APPROVED" && l.approvedAt ? `freigegeben am ${formatDate(l.approvedAt)}` : `angefragt am ${formatDate(l.createdAt)}`}
                      {l.consentAt ? ` · Zustimmung vom ${formatDate(l.consentAt)}` : ""}
                    </div>
                  </div>
                  {l.association.deletedAt ? <Badge tone="neutral">Aufgelöst</Badge> : <Badge tone={associationStatusTone(l.status)}>{associationStatusLabel(l.status)}</Badge>}
                </div>
                {l.association.deletedAt ? (
                  <p className="text-sm text-ink-3">Der Verband wurde aufgelöst und sieht keine Daten. Tretet aus, damit auch bei einer Wiederherstellung nichts geteilt wird.</p>
                ) : l.status === "PENDING" ? (
                  <p className="text-sm text-ink-3">Der Verband muss die Anfrage noch freigeben. Bis dahin sieht er keine Daten.</p>
                ) : null}
                {l.association.deletedAt ? null : <ShareNamesSwitch linkId={l.id} shareNames={l.shareNames} />}
                <LeaveButton linkId={l.id} name={l.association.name} pending={l.status === "PENDING"} />
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <SectionTitle>Verband beitreten</SectionTitle>
      <JoinAssociationForm key={links.map((l) => `${l.id}:${l.status}`).join(",")} />

      {past.length ? (
        <>
          <SectionTitle>Frühere Verbindungen</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {past.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-3 min-h-14">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{l.association.name}</div>
                  <div className="text-xs text-ink-3">{l.revokedAt ? `beendet am ${formatDate(l.revokedAt)}` : ""} · keine Datenfreigabe</div>
                </div>
                <Badge tone="neutral">{associationStatusLabel(l.status)}</Badge>
              </div>
            ))}
          </Card>
        </>
      ) : null}
    </div>
  );
}
