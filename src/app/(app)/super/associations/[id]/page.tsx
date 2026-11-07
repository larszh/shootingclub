import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/tenant";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDate as fmtDate } from "@/lib/i18n/core";
import { Alert, Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getAssociationForSuper, listAssociationMembers } from "@/modules/association/queries";
import { associationStatusLabel, associationStatusTone } from "@/modules/association/access";
import { AddAdminForm, AdminRow, CodeCard, DeleteAssociationButton, EditAssociationForm } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.assoc.a.title") };
}

export default async function SuperAssociationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const formatDate = (d: Date) => fmtDate(d, locale);
  const { id } = await params;
  const a = await getAssociationForSuper(id);
  if (!a) notFound();
  const members = await listAssociationMembers(a.id);

  return (
    <div>
      <PageHeader
        title={a.name}
        subtitle={`${a.region ? `${a.region} · ` : ""}${t("adm2.super.ad.since", { date: formatDate(a.createdAt) })}`}
        back={{ href: "/super/associations", label: t("adm2.super.associations") }}
        action={a.deletedAt ? undefined : <LinkButton href={`/association/${a.id}`} variant="secondary">{t("adm2.super.ad.area")}</LinkButton>}
      />
      {a.deletedAt ? <Alert tone="warn" className="mb-4">{t("adm2.super.ad.deletedOn", { date: formatDate(a.deletedAt) })}</Alert> : null}

      <SectionTitle>{t("adm2.super.ad.joinCode")}</SectionTitle>
      <CodeCard id={a.id} code={a.code} />

      <SectionTitle>{t("adm2.super.ad.details")}</SectionTitle>
      <EditAssociationForm id={a.id} name={a.name} region={a.region} />

      <SectionTitle>{t("adm2.super.ad.access", { n: a.admins.length })}</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {a.admins.map((ad) => (
          <AdminRow key={ad.id} id={ad.id} name={ad.user.name} email={ad.user.email} role={ad.role} deleted={!!ad.user.deletedAt} />
        ))}
        {a.admins.length === 0 ? <p className="p-4 text-sm text-ink-3">{t("adm2.super.ad.noAccess")}</p> : null}
      </Card>
      <div className="mt-2.5"><AddAdminForm associationId={a.id} /></div>
      <p className="mt-2 text-xs text-ink-3">{t("adm2.super.ad.rolesHint")}</p>

      <SectionTitle>{t("adm2.super.ad.clubs", { n: members.length })}</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3 min-h-14">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{m.clubName}</div>
              <div className="text-xs text-ink-3 truncate">
                {m.status === "APPROVED" && m.approvedAt ? t("adm2.super.ad.since", { date: formatDate(m.approvedAt) }) : m.status === "PENDING" ? t("adm2.super.ad.requested", { date: formatDate(m.createdAt) }) : m.revokedAt ? t("adm2.super.ad.ended", { date: formatDate(m.revokedAt) }) : ""}
                {m.shareNames && m.status === "APPROVED" ? t("adm2.super.ad.namesShared") : ""}
              </div>
            </div>
            {m.tenantDeletedAt ? <Badge tone="danger">{t("adm2.super.ad.clubDeleted")}</Badge> : null}
            <Badge tone={associationStatusTone(m.status)}>{associationStatusLabel(m.status, t)}</Badge>
          </div>
        ))}
        {members.length === 0 ? <p className="p-4 text-sm text-ink-3">{t("adm2.super.ad.noClubs")}</p> : null}
      </Card>

      <SectionTitle>{t("adm2.super.ad.delete")}</SectionTitle>
      <DeleteAssociationButton id={a.id} name={a.name} deleted={!!a.deletedAt} />
    </div>
  );
}
