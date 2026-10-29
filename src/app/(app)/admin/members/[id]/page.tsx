import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crosshair, History, Home, Receipt } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Avatar, userAvatarUrl } from "@/components/avatar";
import { Badge, Card, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { ROLE_LABELS, type TenantRole } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { formatDateTimeZurich, formatDateZurich, todayZurich } from "@/lib/time";
import { profileManagedByTenant } from "@/modules/members/ownership";
import { getMemberDetail } from "@/modules/members/queries";
import { dateOnly, displayEmail, formatIsoDate, isMinor, statusLabel, statusTone } from "@/modules/members/types";
import { AccessCard, DangerZone, MemberForm, RoleCard } from "./member-form";

export const metadata: Metadata = { title: "Mitglied" };

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("members.view");
  const canManage = ctx.can("members.manage");
  const detail = await getMemberDetail(ctx.tenant.id, id);
  if (!detail) notFound();
  const { membership: m, access, results, openInvoices } = detail;
  const u = m.user;
  const today = todayZurich();
  const birthDate = dateOnly(u.birthDate);
  const minor = isMinor(birthDate, today);
  const isSelf = u.id === ctx.user.id;
  const canSetOwner = ctx.user.isSuperAdmin || ctx.tenant.role === "OWNER";

  const [categories, households, auditRows, managedHere] = await Promise.all([
    canManage ? db.feeCategory.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, amountCents: true, isActive: true } }) : Promise.resolve([]),
    canManage ? db.household.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
    ctx.can("audit.view") ? db.auditLog.findMany({ where: { tenantId: ctx.tenant.id, entityId: m.id }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, action: true, actorName: true, detail: true, createdAt: true } }) : Promise.resolve([]),
    canManage ? profileManagedByTenant(u.id, ctx.tenant.id) : Promise.resolve(false),
  ]);
  // Personendaten gehören der Person: nur bei Konten, die dieser Verein allein verwaltet, hier änderbar.
  const profileEditable = ctx.user.isSuperAdmin || managedHere;
  const openCount = openInvoices.fees + openInvoices.bookings + openInvoices.ammo;
  const email = displayEmail(u.email);

  return (
    <div>
      <PageHeader title={u.name} back={{ href: "/admin/members", label: "Mitglieder" }} />

      <Card className="animate-rise mb-4 flex items-center gap-4 p-4">
        <Avatar name={u.name} src={userAvatarUrl(u)} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={statusTone(m.status)}>{statusLabel(m.status)}</Badge>
            <Badge tone={m.role === "OWNER" || m.role === "ADMIN" ? "accent" : "neutral"}>{ROLE_LABELS[m.role as TenantRole] ?? m.role}</Badge>
            {minor ? <Badge tone="warn">Minderjährig</Badge> : null}
            {u._count.memberships > 1 ? <Badge tone="outline">In {u._count.memberships} Vereinen</Badge> : null}
          </div>
          <div className="mt-1.5 truncate text-sm text-ink-3">
            {[m.memberNumber ? `Nr. ${m.memberNumber}` : null, email, u.phone].filter(Boolean).join(" · ") || "Keine Kontaktdaten"}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label="Offene Rechnungen" value={openCount} hint={openInvoices.feesCents ? `Beiträge ${formatMoney(openInvoices.feesCents)}` : undefined} icon={<Receipt className="h-4 w-4" />} tone={openCount ? "warn" : "neutral"} />
        <StatCard label="Resultate" value={results.length ? results.length + (results.length === 5 ? "+" : "") : "–"} hint={results[0] ? `zuletzt ${formatDateZurich(results[0].match.date, { weekday: undefined })}` : undefined} icon={<Crosshair className="h-4 w-4" />} />
        <StatCard label="Dabei seit" value={m.joinedAt ? String(m.joinedAt.getUTCFullYear()) : String(m.createdAt.getFullYear())} hint={m.leftAt ? `Austritt ${formatIsoDate(dateOnly(m.leftAt))}` : undefined} />
      </div>

      {canManage ? (
        <>
          <SectionTitle>Daten</SectionTitle>
          <MemberForm
            membershipId={m.id}
            today={today}
            profileEditable={profileEditable}
            emailEditable={profileEditable && !u.passwordSetAt && !u.deletedAt}
            categories={categories.map((c) => ({ id: c.id, label: `${c.name} (${formatMoney(c.amountCents)})${c.isActive ? "" : " – inaktiv"}` }))}
            households={households}
            values={{
              name: u.name,
              email: email ?? "",
              phone: u.phone ?? "",
              birthDate: birthDate ?? "",
              street: u.street ?? "",
              zip: u.zip ?? "",
              city: u.city ?? "",
              memberNumber: m.memberNumber ?? "",
              licenseNumber: m.licenseNumber ?? "",
              status: m.status,
              joinedAt: dateOnly(m.joinedAt) ?? "",
              leftAt: dateOnly(m.leftAt) ?? "",
              feeCategoryId: m.feeCategoryId ?? "",
              feeOverride: m.feeAmountOverrideCents != null ? (m.feeAmountOverrideCents / 100).toFixed(2) : "",
              householdId: m.householdId ?? "",
              guardianName: m.guardianName ?? "",
              guardianEmail: m.guardianEmail ?? "",
              guardianPhone: m.guardianPhone ?? "",
              adminNote: m.adminNote ?? "",
              workHoursExempt: m.workHoursExempt,
            }}
          />

          <SectionTitle>Rolle & Zugang</SectionTitle>
          <div className="space-y-2.5">
            <RoleCard membershipId={m.id} name={u.name} role={m.role} locked={isSelf && !ctx.user.isSuperAdmin} canSetOwner={canSetOwner} />
            <AccessCard membershipId={m.id} access={access} hasTwoFactor={!!u.totpEnabledAt} canSendMail={managedHere} />
          </div>
        </>
      ) : (
        <>
          <SectionTitle>Daten</SectionTitle>
          <Card className="animate-rise overflow-hidden">
            <dl className="divide-y divide-line text-sm">
              <DataRow label="E-Mail" value={email ?? "–"} />
              <DataRow label="Telefon" value={u.phone ?? "–"} />
              <DataRow label="Adresse" value={[u.street, [u.zip, u.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "–"} />
              <DataRow label="Geburtsdatum" value={formatIsoDate(birthDate)} />
              <DataRow label="Lizenz" value={m.licenseNumber ?? "–"} />
              <DataRow label="Eintritt" value={formatIsoDate(dateOnly(m.joinedAt))} />
              {m.household ? <DataRow label="Haushalt" value={m.household.name} /> : null}
              {minor && (m.guardianName || m.guardianPhone || m.guardianEmail) ? (
                <DataRow label="Vertretung" value={[m.guardianName, m.guardianPhone, m.guardianEmail].filter(Boolean).join(" · ")} />
              ) : null}
            </dl>
          </Card>
        </>
      )}

      {m.household ? (
        <>
          <SectionTitle action={canManage ? <Link href="/admin/members/households" className="text-sm font-medium text-accent">Haushalte</Link> : undefined}>Haushalt</SectionTitle>
          <Card className="animate-rise flex items-start gap-3 p-4">
            <Home className="mt-0.5 h-5 w-5 shrink-0 text-ink-2" aria-hidden />
            <div className="min-w-0 text-sm">
              <div className="font-medium">{m.household.name}</div>
              <div className="text-ink-3">
                {m.household.payerUserId === u.id ? "Zahlt die Haushaltsrechnung" : "Rechnung geht an die zahlende Person im Haushalt"}
                {m.household.memberships.length ? ` · mit ${m.household.memberships.map((x) => x.user.name).join(", ")}` : ""}
              </div>
            </div>
          </Card>
        </>
      ) : null}

      {results.length ? (
        <>
          <SectionTitle>Letzte Resultate</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {results.map((r) => (
              <Link key={r.id} href={`/scores/matches/${r.match.id}`} className="flex min-h-13 items-center gap-3 px-4 py-2 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.match.title || r.match.program.name}</div>
                  <div className="text-xs text-ink-3">{formatDateZurich(r.match.date)}{r.isOfficial ? " · amtlich" : ""}{r.passed === false ? " · nicht bestanden" : ""}</div>
                </div>
                <span className="text-lg font-semibold tabular-nums">{r.total != null ? Math.round(r.total * 10) / 10 : "–"}</span>
              </Link>
            ))}
          </Card>
        </>
      ) : null}

      {auditRows.length ? (
        <>
          <SectionTitle action={<Link href="/admin/audit" className="text-sm font-medium text-accent">Protokoll</Link>}>Änderungen</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {auditRows.map((a) => (
              <div key={a.id} className="flex gap-3 px-4 py-3 text-sm">
                <History className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                <div className="min-w-0">
                  <div className="break-words">{a.detail ?? a.action}</div>
                  <div className="text-xs text-ink-3">{formatDateTimeZurich(a.createdAt)}{a.actorName ? ` · ${a.actorName}` : ""}</div>
                </div>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      {canManage && !isSelf && m.role !== "OWNER" ? <DangerZone membershipId={m.id} name={u.name} status={m.status} /> : null}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <dt className="w-28 shrink-0 text-ink-3">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{value}</dd>
    </div>
  );
}
