import type { Metadata } from "next";
import { ExternalLink, Settings } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { TenantLogo } from "@/components/logo";
import { userAvatarUrl } from "@/components/avatar";
import { TENANT_ROLES } from "@/lib/permissions";
import { formatDateZurich } from "@/lib/time";
import { displayEmail } from "@/modules/members/types";
import { MemberDirectory, type DirectoryMember } from "./directory";

export const metadata: Metadata = { title: "Mitglieder" };

const ROLE_ORDER = new Map<string, number>(TENANT_ROLES.map((r, i) => [r, i]));

export default async function MembersDirectoryPage() {
  const ctx = await requireTenant();
  const canViewContacts = ctx.can("members.view");
  const [tenant, memberships] = await Promise.all([
    db.tenant.findUniqueOrThrow({ where: { id: ctx.tenant.id }, select: { name: true, city: true, canton: true, description: true, website: true } }),
    db.membership.findMany({
      // Ausgetretene erscheinen nicht im Verzeichnis.
      where: { tenantId: ctx.tenant.id, status: { not: "LEFT" } },
      select: { id: true, role: true, status: true, createdAt: true, joinedAt: true, user: { select: { id: true, name: true, email: true, phone: true, avatarPath: true, updatedAt: true } } },
    }),
  ]);

  const members: DirectoryMember[] = memberships
    .map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      // Kontaktdaten nur für Vorstand/Trainer (members.view)
      email: canViewContacts ? displayEmail(m.user.email) : null,
      phone: canViewContacts ? m.user.phone : null,
      role: m.role,
      status: m.status,
      avatarUrl: userAvatarUrl(m.user),
      since: formatDateZurich(m.joinedAt ?? m.createdAt, { weekday: undefined, day: undefined, month: "long", year: "numeric" }),
      isSelf: m.user.id === ctx.user.id,
    }))
    .sort((a, b) => (ROLE_ORDER.get(a.role) ?? 9) - (ROLE_ORDER.get(b.role) ?? 9) || a.name.localeCompare(b.name, "de-CH"));

  const place = [tenant.city, tenant.canton].filter(Boolean).join(" ");
  const websiteLabel = tenant.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div>
      <PageHeader
        title="Mitglieder"
        subtitle={`${members.length} ${members.length === 1 ? "Mitglied" : "Mitglieder"} in ${tenant.name}`}
        back={{ href: "/me", label: "Mehr" }}
        action={canViewContacts ? <LinkButton href="/admin/members" variant="secondary" size="sm"><Settings className="h-4 w-4" /> Verwalten</LinkButton> : undefined}
      />

      {tenant.description || tenant.website || ctx.tenant.logoUrl ? (
        <Card className="animate-rise mb-4 flex gap-4 p-4">
          <TenantLogo src={ctx.tenant.logoUrl} size={56} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{tenant.name}</div>
            {place ? <div className="text-xs text-ink-3">{place}</div> : null}
            {tenant.description ? <p className="mt-1.5 whitespace-pre-line text-sm text-ink-2">{tenant.description}</p> : null}
            {tenant.website ? (
              <a href={tenant.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                {websiteLabel} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </Card>
      ) : null}

      <MemberDirectory members={members} />
    </div>
  );
}
