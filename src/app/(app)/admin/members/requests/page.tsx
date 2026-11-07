import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { userAvatarUrl } from "@/components/avatar";
import { formatDateTime, getRequestLocale, getT } from "@/lib/i18n";
import { JoinApprovalToggle, JoinRequestRow } from "./forms";
import { MembersNav } from "../nav";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.home.requests") };
}

/** Offene Beitrittsanfragen (Membership PENDING) freigeben oder ablehnen; Einstellung «Beitritt mit Freigabe». */
export default async function JoinRequestsPage() {
  const ctx = await requirePermission("members.approve");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const [requests, tenant] = await Promise.all([
    db.membership.findMany({
      where: { tenantId: ctx.tenant.id, status: "PENDING", user: { deletedAt: null } },
      include: { user: { select: { id: true, name: true, email: true, avatarPath: true, updatedAt: true } } },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    db.tenant.findUniqueOrThrow({ where: { id: ctx.tenant.id }, select: { joinApproval: true, joinCode: true } }),
  ]);

  return (
    <div>
      <PageHeader title={t("adm1.home.requests")} subtitle={t(requests.length === 1 ? "adm1.req.waiting.one" : "adm1.req.waiting.other", { n: requests.length })} back={{ href: "/admin/members", label: t("adm1.members.title") }} />
      <MembersNav active="requests" canApprove tenantId={ctx.tenant.id} canManage={ctx.can("members.manage")} />

      {ctx.can("tenant.manage") ? (
        <Card className="animate-rise mb-2 p-4">
          <JoinApprovalToggle locale={locale} enabled={tenant.joinApproval} />
        </Card>
      ) : null}
      <p className="mb-2 px-1 text-xs text-ink-3">
        {tenant.joinApproval
          ? <>{t("adm1.req.onBefore")} <strong className="font-mono">{tenant.joinCode}</strong> {t("adm1.req.onAfter")}</>
          : <>{t("adm1.req.offBefore")} <strong className="font-mono">{tenant.joinCode}</strong> {t("adm1.req.offAfter")}</>}
      </p>

      <SectionTitle>{t("adm1.req.open")}</SectionTitle>
      {requests.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {requests.map((m) => (
            <JoinRequestRow key={m.id} locale={locale} membershipId={m.id} name={m.user.name} email={m.user.email.endsWith(".invalid") ? null : m.user.email}
              avatarUrl={userAvatarUrl(m.user)} since={formatDateTime(m.createdAt, locale)} />
          ))}
        </Card>
      ) : (
        <EmptyState icon={<UserPlus className="h-5 w-5" />} title={t("adm1.req.emptyTitle")} text={t(tenant.joinApproval ? "adm1.req.emptyOn" : "adm1.req.emptyOff")} />
      )}
    </div>
  );
}
