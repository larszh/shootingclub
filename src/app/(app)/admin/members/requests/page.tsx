import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { userAvatarUrl } from "@/components/avatar";
import { formatDateTimeZurich } from "@/lib/time";
import { JoinApprovalToggle, JoinRequestRow } from "./forms";
import { MembersNav } from "../nav";

export const metadata: Metadata = { title: "Beitrittsanfragen" };

/** Offene Beitrittsanfragen (Membership PENDING) freigeben oder ablehnen; Einstellung «Beitritt mit Freigabe». */
export default async function JoinRequestsPage() {
  const ctx = await requirePermission("members.approve");
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
      <PageHeader title="Beitrittsanfragen" subtitle={requests.length === 1 ? "1 Person wartet auf Freigabe" : `${requests.length} Personen warten auf Freigabe`} back={{ href: "/admin/members", label: "Mitglieder" }} />
      <MembersNav active="requests" canApprove tenantId={ctx.tenant.id} canManage={ctx.can("members.manage")} />

      {ctx.can("tenant.manage") ? (
        <Card className="animate-rise mb-2 p-4">
          <JoinApprovalToggle enabled={tenant.joinApproval} />
        </Card>
      ) : null}
      <p className="mb-2 px-1 text-xs text-ink-3">
        {tenant.joinApproval
          ? <>Wer mit dem Beitrittscode <strong className="font-mono">{tenant.joinCode}</strong> beitritt, erscheint hier und hat erst nach der Freigabe Zugang. Einladungen per E-Mail gelten weiterhin sofort.</>
          : <>Beitritt mit dem Code <strong className="font-mono">{tenant.joinCode}</strong> gilt sofort. Mit «Beitritt mit Freigabe» prüft ihr neue Personen zuerst.</>}
      </p>

      <SectionTitle>Offene Anfragen</SectionTitle>
      {requests.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {requests.map((m) => (
            <JoinRequestRow key={m.id} membershipId={m.id} name={m.user.name} email={m.user.email.endsWith(".invalid") ? null : m.user.email}
              avatarUrl={userAvatarUrl(m.user)} since={formatDateTimeZurich(m.createdAt)} />
          ))}
        </Card>
      ) : (
        <EmptyState icon={<UserPlus className="h-5 w-5" />} title="Keine offenen Anfragen" text={tenant.joinApproval ? "Neue Anfragen erscheinen hier, die Verwaltung erhält eine Mitteilung." : "Beitritt mit Freigabe ist ausgeschaltet."} />
      )}
    </div>
  );
}
