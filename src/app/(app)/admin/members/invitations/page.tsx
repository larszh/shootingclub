import type { Metadata } from "next";
import Link from "next/link";
import { MailOpen } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { formatDate, getRequestLocale, getT } from "@/lib/i18n";
import { listOpenInvitations } from "@/modules/members/queries";
import { MembersNav } from "../nav";
import { InvitationRow, InviteForm } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.home.invite") };
}

export default async function InvitationsPage() {
  const ctx = await requirePermission("members.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const [invitations, households, tenant] = await Promise.all([
    listOpenInvitations(ctx.tenant.id),
    db.household.count({ where: { tenantId: ctx.tenant.id } }),
    db.tenant.findUniqueOrThrow({ where: { id: ctx.tenant.id }, select: { joinCode: true } }),
  ]);
  const inviterIds = [...new Set(invitations.map((i) => i.invitedById).filter((x): x is string => !!x))];
  const inviters = inviterIds.length ? await db.user.findMany({ where: { id: { in: inviterIds } }, select: { id: true, name: true } }) : [];
  const inviterName = new Map(inviters.map((u) => [u.id, u.name]));
  const now = new Date();
  const open = invitations.filter((i) => i.expiresAt > now).length;

  return (
    <div>
      <PageHeader title={t("adm1.home.invite")} subtitle={t("adm1.inv.subtitle")} back={{ href: "/admin/members", label: t("adm1.members.title") }} />
      <MembersNav active="invitations" canApprove={ctx.can("members.approve")} tenantId={ctx.tenant.id} canManage counts={{ invitations: open, households }} />

      <SectionTitle>{t("adm1.inv.send")}</SectionTitle>
      <InviteForm locale={locale} canInviteAdmin={ctx.can("tenant.manage")} />
      <p className="mt-2 px-1 text-xs text-ink-3">
        {t("adm1.inv.explain")}
        {ctx.can("tenant.manage") ? <> {t("adm1.inv.alternative")} <strong className="font-mono">{tenant.joinCode}</strong> (<Link href="/admin" className="underline">{t("adm1.home.title")}</Link>).</> : null}
      </p>

      <SectionTitle>{t("adm1.inv.open")}</SectionTitle>
      {invitations.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {invitations.map((i) => (
            <InvitationRow
              key={i.id}
              locale={locale}
              id={i.id}
              email={i.email}
              name={i.name}
              role={["OWNER", "ADMIN", "TRAINER", "MEMBER"].includes(i.role) ? t(`role.${i.role}`) : i.role}
              expired={i.expiresAt <= now}
              meta={`${i.expiresAt <= now ? t("adm1.inv.expired") : t("adm1.inv.validUntil", { date: formatDate(i.expiresAt, locale) })}${i.invitedById && inviterName.get(i.invitedById) ? ` · ${t("adm1.inv.by", { name: inviterName.get(i.invitedById)! })}` : ""}`}
            />
          ))}
        </Card>
      ) : (
        <EmptyState icon={<MailOpen className="h-5 w-5" />} title={t("adm1.inv.emptyTitle")} text={t("adm1.inv.emptyText")} />
      )}
    </div>
  );
}
