import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crosshair, History, Home, Receipt } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Avatar, userAvatarUrl } from "@/components/avatar";
import { Badge, Card, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { todayZurich } from "@/lib/time";
import { formatDate, formatDateTime, getRequestLocale, getT } from "@/lib/i18n";
import { profileManagedByTenant } from "@/modules/members/ownership";
import { getMemberDetail } from "@/modules/members/queries";
import { dateOnly, displayEmail, isMemberStatus, isMinor, statusTone } from "@/modules/members/types";
import { AccessCard, DangerZone, MemberForm, RoleCard } from "./member-form";
import { localizedProgramName } from "@/modules/scores/preset-i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.common.member") };
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("members.view");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const isoDate = (s: string | null) => (s ? formatDate(new Date(`${s}T12:00:00Z`), locale) : "–");
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
      <PageHeader title={u.name} back={{ href: "/admin/members", label: t("adm1.members.title") }} />

      <Card className="animate-rise mb-4 flex items-center gap-4 p-4">
        <Avatar name={u.name} src={userAvatarUrl(u)} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={statusTone(m.status)}>{isMemberStatus(m.status) ? t(`members.status.${m.status}`) : m.status}</Badge>
            <Badge tone={m.role === "OWNER" || m.role === "ADMIN" ? "accent" : "neutral"}>{["OWNER", "ADMIN", "TRAINER", "MEMBER"].includes(m.role) ? t(`role.${m.role}`) : m.role}</Badge>
            {minor ? <Badge tone="warn">{t("adm1.member.minor")}</Badge> : null}
            {u._count.memberships > 1 ? <Badge tone="outline">{t("adm1.member.inClubs", { n: u._count.memberships })}</Badge> : null}
          </div>
          <div className="mt-1.5 truncate text-sm text-ink-3">
            {[m.memberNumber ? t("adm1.members.numberShort", { nr: m.memberNumber }) : null, email, u.phone].filter(Boolean).join(" · ") || t("adm1.member.noContact")}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label={t("adm1.member.openInvoices")} value={openCount} hint={openInvoices.feesCents ? t("adm1.member.feesAmount", { amount: formatMoney(openInvoices.feesCents) }) : undefined} icon={<Receipt className="h-4 w-4" />} tone={openCount ? "warn" : "neutral"} />
        <StatCard label={t("adm1.member.results")} value={results.length ? results.length + (results.length === 5 ? "+" : "") : "–"} hint={results[0] ? t("adm1.member.lastOn", { date: formatDate(results[0].match.date, locale) }) : undefined} icon={<Crosshair className="h-4 w-4" />} />
        <StatCard label={t("adm1.member.since")} value={m.joinedAt ? String(m.joinedAt.getUTCFullYear()) : String(m.createdAt.getFullYear())} hint={m.leftAt ? t("adm1.member.leftOn", { date: isoDate(dateOnly(m.leftAt)) }) : undefined} />
      </div>

      {canManage ? (
        <>
          <SectionTitle>{t("adm1.member.data")}</SectionTitle>
          <MemberForm
            locale={locale}
            membershipId={m.id}
            today={today}
            profileEditable={profileEditable}
            emailEditable={profileEditable && !u.passwordSetAt && !u.deletedAt}
            categories={categories.map((c) => ({ id: c.id, label: `${c.name} (${formatMoney(c.amountCents)})${c.isActive ? "" : ` – ${t("adm1.member.inactiveSuffix")}`}` }))}
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

          <SectionTitle>{t("adm1.member.roleAccess")}</SectionTitle>
          <div className="space-y-2.5">
            <RoleCard locale={locale} membershipId={m.id} name={u.name} role={m.role} locked={isSelf && !ctx.user.isSuperAdmin} canSetOwner={canSetOwner} />
            <AccessCard locale={locale} membershipId={m.id} access={access} hasTwoFactor={!!u.totpEnabledAt} canSendMail={managedHere} />
          </div>
        </>
      ) : (
        <>
          <SectionTitle>{t("adm1.member.data")}</SectionTitle>
          <Card className="animate-rise overflow-hidden">
            <dl className="divide-y divide-line text-sm">
              <DataRow label={t("adm1.common.email")} value={email ?? "–"} />
              <DataRow label={t("adm1.member.phone")} value={u.phone ?? "–"} />
              <DataRow label={t("adm1.member.address")} value={[u.street, [u.zip, u.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "–"} />
              <DataRow label={t("adm1.member.birthDate")} value={isoDate(birthDate)} />
              <DataRow label={t("adm1.member.license")} value={m.licenseNumber ?? "–"} />
              <DataRow label={t("adm1.member.joined")} value={isoDate(dateOnly(m.joinedAt))} />
              {m.household ? <DataRow label={t("adm1.members.household")} value={m.household.name} /> : null}
              {minor && (m.guardianName || m.guardianPhone || m.guardianEmail) ? (
                <DataRow label={t("adm1.member.guardianShort")} value={[m.guardianName, m.guardianPhone, m.guardianEmail].filter(Boolean).join(" · ")} />
              ) : null}
            </dl>
          </Card>
        </>
      )}

      {m.household ? (
        <>
          <SectionTitle action={canManage ? <Link href="/admin/members/households" className="text-sm font-medium text-accent">{t("adm1.home.households")}</Link> : undefined}>{t("adm1.members.household")}</SectionTitle>
          <Card className="animate-rise flex items-start gap-3 p-4">
            <Home className="mt-0.5 h-5 w-5 shrink-0 text-ink-2" aria-hidden />
            <div className="min-w-0 text-sm">
              <div className="font-medium">{m.household.name}</div>
              <div className="text-ink-3">
                {t(m.household.payerUserId === u.id ? "adm1.member.paysHousehold" : "adm1.member.householdPayer")}
                {m.household.memberships.length ? ` · ${t("adm1.member.withNames", { names: m.household.memberships.map((x) => x.user.name).join(", ") })}` : ""}
              </div>
            </div>
          </Card>
        </>
      ) : null}

      {results.length ? (
        <>
          <SectionTitle>{t("adm1.member.lastResults")}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {results.map((r) => (
              <Link key={r.id} href={`/scores/matches/${r.match.id}`} className="flex min-h-13 items-center gap-3 px-4 py-2 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.match.title || localizedProgramName(r.match.program.name, locale)}</div>
                  <div className="text-xs text-ink-3">{formatDate(r.match.date, locale)}{r.isOfficial ? ` · ${t("adm1.member.official")}` : ""}{r.passed === false ? ` · ${t("adm1.member.notPassed")}` : ""}</div>
                </div>
                <span className="text-lg font-semibold tabular-nums">{r.total != null ? Math.round(r.total * 10) / 10 : "–"}</span>
              </Link>
            ))}
          </Card>
        </>
      ) : null}

      {auditRows.length ? (
        <>
          <SectionTitle action={<Link href="/admin/audit" className="text-sm font-medium text-accent">{t("adm1.home.audit")}</Link>}>{t("adm1.member.changes")}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {auditRows.map((a) => (
              <div key={a.id} className="flex gap-3 px-4 py-3 text-sm">
                <History className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                <div className="min-w-0">
                  <div className="break-words">{a.detail ?? a.action}</div>
                  <div className="text-xs text-ink-3">{formatDateTime(a.createdAt, locale)}{a.actorName ? ` · ${a.actorName}` : ""}</div>
                </div>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      {canManage && !isSelf && m.role !== "OWNER" ? <DangerZone locale={locale} membershipId={m.id} name={u.name} status={m.status} /> : null}
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
