import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDate as fmtDate } from "@/lib/i18n/core";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { listClubAssociations } from "@/modules/association/queries";
import { associationStatusLabel, associationStatusTone } from "@/modules/association/access";
import { JoinAssociationForm, LeaveButton, ShareNamesSwitch } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.assoc.a.title") };
}

export default async function AdminAssociationPage() {
  const ctx = await requirePermission("tenant.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const formatDate = (d: Date) => fmtDate(d, locale);
  const links = await listClubAssociations(ctx.tenant.id);
  const current = links.filter((l) => l.status !== "REVOKED");
  const past = links.filter((l) => l.status === "REVOKED");

  return (
    <div>
      <PageHeader title={t("adm2.assoc.a.title")} subtitle={t("adm2.assoc.a.subtitle")} back={{ href: "/admin", label: t("adm2.common.settings") }} />
      <p className="mb-4 text-sm text-ink-2">
        {t("adm2.assoc.a.intro")}
      </p>

      {current.length ? (
        <>
          <SectionTitle>{t("adm2.assoc.a.connected")}</SectionTitle>
          <div className="space-y-2.5">
            {current.map((l) => (
              <Card key={l.id} className="animate-rise p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-ink-2" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{l.association.name}</div>
                    <div className="text-xs text-ink-3">
                      {l.association.region ? `${l.association.region} · ` : ""}
                      {l.status === "APPROVED" && l.approvedAt ? t("adm2.assoc.a.approvedOn", { date: formatDate(l.approvedAt) }) : t("adm2.assoc.a.requestedOn", { date: formatDate(l.createdAt) })}
                      {l.consentAt ? t("adm2.assoc.a.consentOn", { date: formatDate(l.consentAt) }) : ""}
                    </div>
                  </div>
                  {l.association.deletedAt ? <Badge tone="neutral">{t("adm2.assoc.a.dissolved")}</Badge> : <Badge tone={associationStatusTone(l.status)}>{associationStatusLabel(l.status, t)}</Badge>}
                </div>
                {l.association.deletedAt ? (
                  <p className="text-sm text-ink-3">{t("adm2.assoc.a.dissolvedText")}</p>
                ) : l.status === "PENDING" ? (
                  <p className="text-sm text-ink-3">{t("adm2.assoc.a.pendingText")}</p>
                ) : null}
                {l.association.deletedAt ? null : <ShareNamesSwitch linkId={l.id} shareNames={l.shareNames} />}
                <LeaveButton linkId={l.id} name={l.association.name} pending={l.status === "PENDING"} />
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <SectionTitle>{t("adm2.assoc.a.join")}</SectionTitle>
      <JoinAssociationForm key={links.map((l) => `${l.id}:${l.status}`).join(",")} />

      {past.length ? (
        <>
          <SectionTitle>{t("adm2.assoc.a.past")}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {past.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-3 min-h-14">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{l.association.name}</div>
                  <div className="text-xs text-ink-3">{l.revokedAt ? t("adm2.assoc.a.endedOn", { date: formatDate(l.revokedAt) }) : ""}{t("adm2.assoc.a.noSharing")}</div>
                </div>
                <Badge tone="neutral">{associationStatusLabel(l.status, t)}</Badge>
              </div>
            ))}
          </Card>
        </>
      ) : null}
    </div>
  );
}
