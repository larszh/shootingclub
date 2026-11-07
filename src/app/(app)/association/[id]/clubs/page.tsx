import type { Metadata } from "next";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDate as fmtDate } from "@/lib/i18n/core";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { associationStatusLabel, canManageClubs, sharesAggregates } from "@/modules/association/access";
import { listAssociationMembers, requireAssociation } from "@/modules/association/queries";
import { AssociationTabs } from "../tabs";
import { PendingActions, RemoveClubButton } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.assoc.c.meta") };
}

export default async function AssociationClubsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAssociation(id);
  const locale = await getRequestLocale();
  const t = getT(locale);
  const formatDate = (d: Date) => fmtDate(d, locale);
  const manage = canManageClubs(ctx.access) && !ctx.association.deletedAt;
  // Gelöschte Vereine erscheinen nicht (weder Name noch Status).
  const members = (await listAssociationMembers(ctx.association.id)).filter((m) => !m.tenantDeletedAt);
  const pending = members.filter((m) => m.status === "PENDING");
  const active = members.filter((m) => m.status === "APPROVED");
  const revoked = members.filter((m) => m.status === "REVOKED");
  const place = (m: { city: string | null; canton: string | null }) => [m.city, m.canton].filter(Boolean).join(", ");

  return (
    <div>
      <PageHeader title={t("adm2.assoc.d.clubs")} subtitle={ctx.association.name} back={{ href: "/association", label: t("adm2.assoc.a.title") }} />
      <AssociationTabs id={ctx.association.id} active="clubs" pending={pending.length} />

      <SectionTitle>{t("adm2.assoc.c.requests", { n: pending.length })}</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {pending.map((m) => (
          <div key={m.id} className="px-4 py-3 space-y-3">
            <div>
              <div className="font-medium">{m.clubName}</div>
              <div className="text-xs text-ink-3">{place(m) ? `${place(m)} · ` : ""}{t("adm2.assoc.c.requestedOn", { date: formatDate(m.createdAt) })}{m.shareNames ? t("adm2.assoc.c.withNames") : t("adm2.assoc.c.numbersOnly")}</div>
            </div>
            {manage ? <PendingActions associationId={ctx.association.id} memberId={m.id} clubName={m.clubName} /> : null}
          </div>
        ))}
        {pending.length === 0 ? <p className="p-4 text-sm text-ink-3">{t("adm2.assoc.c.noRequests")}</p> : null}
      </Card>

      <SectionTitle>{t("adm2.assoc.c.active", { n: active.length })}</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {active.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3 min-h-14">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{m.clubName}</div>
              <div className="text-xs text-ink-3 truncate">{place(m) ? `${place(m)} · ` : ""}{m.approvedAt ? t("adm2.assoc.c.since", { date: formatDate(m.approvedAt) }) : ""}</div>
            </div>
            {sharesAggregates(m) ? null : <Badge tone="warn">{t("adm2.assoc.c.noConsent")}</Badge>}
            <Badge tone={m.shareNames ? "ok" : "outline"}>{m.shareNames ? t("adm2.assoc.c.names") : t("adm2.assoc.c.onlyNumbers")}</Badge>
            {manage ? <RemoveClubButton associationId={ctx.association.id} memberId={m.id} clubName={m.clubName} /> : null}
          </div>
        ))}
        {active.length === 0 ? <p className="p-4 text-sm text-ink-3">{t("adm2.assoc.c.noActive")}</p> : null}
      </Card>

      {revoked.length ? (
        <>
          <SectionTitle>{t("adm2.assoc.c.ended", { n: revoked.length })}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {revoked.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 min-h-14">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{m.clubName}</div>
                  <div className="text-xs text-ink-3">{m.revokedAt ? t("adm2.assoc.c.endedOn", { date: formatDate(m.revokedAt) }) : ""}</div>
                </div>
                <Badge tone="neutral">{associationStatusLabel(m.status, t)}</Badge>
              </div>
            ))}
          </Card>
        </>
      ) : null}
      <p className="mt-4 text-xs text-ink-3">{t("adm2.assoc.c.footer", { code: ctx.association.code })}</p>
    </div>
  );
}
