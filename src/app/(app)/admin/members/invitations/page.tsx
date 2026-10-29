import type { Metadata } from "next";
import Link from "next/link";
import { MailOpen } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { ROLE_LABELS, type TenantRole } from "@/lib/permissions";
import { formatDateZurich } from "@/lib/time";
import { listOpenInvitations } from "@/modules/members/queries";
import { MembersNav } from "../nav";
import { AddExistingForm, InvitationRow, InviteForm } from "./forms";

export const metadata: Metadata = { title: "Mitglieder einladen" };

export default async function InvitationsPage() {
  const ctx = await requirePermission("members.manage");
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
      <PageHeader title="Mitglieder einladen" subtitle="Per E-Mail mit persönlichem Link" back={{ href: "/admin/members", label: "Mitglieder" }} />
      <MembersNav active="invitations" canManage counts={{ invitations: open, households }} />

      <SectionTitle>Einladung senden</SectionTitle>
      <InviteForm canInviteAdmin={ctx.can("tenant.manage")} />
      <p className="mt-2 px-1 text-xs text-ink-3">
        Die Person erhält eine Mail mit einem Link (14 Tage gültig). Ohne Konto registriert sie sich, mit Konto meldet sie sich an – danach ist sie Mitglied.
        {ctx.can("tenant.manage") ? <> Alternativ: Beitrittscode <strong className="font-mono">{tenant.joinCode}</strong> (<Link href="/admin" className="underline">Einstellungen</Link>).</> : null}
      </p>

      <SectionTitle>Offene Einladungen</SectionTitle>
      {invitations.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {invitations.map((i) => (
            <InvitationRow
              key={i.id}
              id={i.id}
              email={i.email}
              name={i.name}
              role={ROLE_LABELS[i.role as TenantRole] ?? i.role}
              expired={i.expiresAt <= now}
              meta={`${i.expiresAt <= now ? "Abgelaufen" : `Gültig bis ${formatDateZurich(i.expiresAt, { weekday: undefined })}`}${i.invitedById && inviterName.get(i.invitedById) ? ` · von ${inviterName.get(i.invitedById)}` : ""}`}
            />
          ))}
        </Card>
      ) : (
        <EmptyState icon={<MailOpen className="h-5 w-5" />} title="Keine offenen Einladungen" text="Angenommene Einladungen erscheinen direkt in der Mitgliederliste." />
      )}

      <SectionTitle>Bestehendes Konto direkt hinzufügen</SectionTitle>
      <AddExistingForm />
    </div>
  );
}
