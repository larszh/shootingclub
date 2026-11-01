import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BookUser, CalendarDays, ChevronRight, CreditCard, FileUp, FolderOpen, History, Home, KeyRound, LogOut, Mail, Megaphone, MessageCircle, Package, Server, Settings, Shield, ShieldCheck, Target, Users, BarChart3, Wallet, BadgeCheck, Trophy, Tv, DoorOpen, HandHelping, GraduationCap, Award, Boxes, Clock, Coffee, FileInput, BookOpenCheck, Code2, Handshake } from "lucide-react";
import { getAppContext } from "@/lib/tenant";
import { db } from "@/lib/db";
import { logoutAction } from "@/modules/core/auth-actions";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { Avatar, tenantLogoUrl } from "@/components/avatar";
import { TenantLogo } from "@/components/logo";
import { formatDate, getRequestLocale, getT, type TFunction } from "@/lib/i18n";
import { todayZurich } from "@/lib/time";
import { accessStatusWhere } from "@/lib/membership-access";
import { dateOnly } from "@/modules/members/types";
import { AvatarCard, ProfileForm, TenantSwitcher, ThemePicker } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.nav.more") };
}

/** Übersetzt einen Schlüssel mit Rückfall auf den Rohwert (z.B. unbekannte Rolle). */
function labelOr(t: TFunction, key: string, raw: string) {
  const v = t(key);
  return v === key ? raw : v;
}

/** ISO-Datum (JJJJ-MM-TT) in der Sprache des Benutzers, ohne Zeitzonen-Verschiebung. */
function formatIso(iso: string | null, locale: string) {
  if (!iso) return "–";
  return formatDate(new Date(`${iso}T12:00:00Z`), locale);
}

export default async function MePage() {
  const ctx = await getAppContext();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const roleLabel = (r: string) => labelOr(t, `role.${r}`, r);
  const canManage = ctx.tenant ? ctx.can("tenant.manage") : false;
  const canManageAmmo = ctx.tenant ? ctx.can("ammo.manage") : false;
  const canViewMembers = ctx.tenant ? ctx.can("members.view") : false;
  const canManageMembers = ctx.tenant ? ctx.can("members.manage") : false;
  const canAudit = ctx.tenant ? ctx.can("audit.view") : false;
  const paymentsOn = ctx.hasModule("billing") || ctx.hasModule("bookings") || ctx.hasModule("ammo");
  // Welle B: Schiessen und Verein (nur aktive Module und passende Rechte)
  const can = (p: Parameters<typeof ctx.can>[0]) => (ctx.tenant ? ctx.can(p) : false);
  const canLive = ctx.hasModule("scores") && (can("match.viewAll") || can("events.manage"));
  const canWeapons = ctx.hasModule("weapons") && can("weapons.loan");
  const canScoreImport = ctx.hasModule("scores") && (can("match.viewAll") || can("tenant.programs.manage"));
  const kioskOn = ctx.hasModule("kiosk");
  const shootingOn = ctx.hasModule("federal") || ctx.hasModule("championship") || canLive || canScoreImport;
  const clubOn = ctx.hasModule("range") || ctx.hasModule("shifts") || ctx.hasModule("courses") || canWeapons || kioskOn;
  // Welle C: Buchhaltung, Website-Widgets, Schützenstube, Partner-Anlagen
  const adminAccounting = can("accounting.export");
  const adminKiosk = kioskOn && can("kiosk.manage");
  const adminPartners = canManage && ctx.hasModule("bookings");
  const adminRange = ctx.hasModule("range") && can("range.manage");
  const adminShifts = ctx.hasModule("shifts") && can("shifts.manage");
  const adminQuali = can("qualifications.manage") || canViewMembers;
  const adminStock = ctx.hasModule("ammo") && canManageAmmo;

  const profile = await db.user.findUniqueOrThrow({ where: { id: ctx.user.id }, select: { phone: true, birthDate: true } });
  const memberships = await db.membership.findMany({
    where: { userId: ctx.user.id },
    select: {
      id: true,
      role: true,
      status: true,
      memberNumber: true,
      createdAt: true,
      joinedAt: true,
      tenant: { select: { id: true, name: true, kind: true, city: true, logoPath: true, updatedAt: true, _count: { select: { memberships: { where: { status: accessStatusWhere() } } } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="animate-fade mb-5 flex items-center gap-4">
        <Avatar name={ctx.user.name} src={ctx.user.avatarUrl} size={64} />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight leading-tight truncate">{ctx.user.name}</h1>
          <p className="text-ink-3 text-sm mt-0.5 truncate">{ctx.user.email}</p>
        </div>
      </div>

      <SectionTitle>{t("shell.me.clubSection")}</SectionTitle>
      <TenantSwitcher
        activeId={ctx.tenant?.id ?? null}
        labels={{ join: t("shell.me.joinAnother"), help: t("shell.me.helpFaq"), offline: t("shell.me.offline") }}
        tenants={ctx.user.memberships.map((m) => ({ id: m.tenantId, name: m.tenant.name, role: roleLabel(m.role), logoUrl: tenantLogoUrl(m.tenant) }))}
      />

      {ctx.tenant ? (
        <>
          <SectionTitle>{ctx.tenant.name}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {/* Alle Module, auch die, die mobil nicht in die Tableiste passen */}
            {ctx.hasModule("chat") ? <Row href="/chat" icon={<MessageCircle className="h-4 w-4" />} label={t("shell.me.row.chat")} /> : null}
            {ctx.hasModule("events") ? <Row href="/events" icon={<Megaphone className="h-4 w-4" />} label={t("shell.me.row.events")} /> : null}
            {ctx.hasModule("bookings") ? <Row href="/bookings" icon={<CalendarDays className="h-4 w-4" />} label={t("shell.me.row.bookings")} /> : null}
            {ctx.hasModule("targets") ? <Row href="/targets" icon={<Target className="h-4 w-4" />} label={t("shell.me.row.targets")} /> : null}
            {ctx.hasModule("files") ? <Row href="/files" icon={<FolderOpen className="h-4 w-4" />} label={t("shell.me.row.files")} /> : null}
            {ctx.hasModule("ammo") ? <Row href="/ammo" icon={<Package className="h-4 w-4" />} label={t("shell.me.row.ammo")} /> : null}
            {paymentsOn ? <Row href="/payments" icon={<Wallet className="h-4 w-4" />} label={t("shell.me.row.payments")} /> : null}
            {ctx.hasModule("billing") ? <Row href="/billing" icon={<CreditCard className="h-4 w-4" />} label={t("shell.me.row.billing")} /> : null}
            {ctx.hasModule("scores") ? <Row href="/scores/stats" icon={<BarChart3 className="h-4 w-4" />} label={t("shell.me.row.stats")} /> : null}
            <Row href="/members" icon={<BookUser className="h-4 w-4" />} label={t("shell.me.row.directory")} />
          </Card>
          {shootingOn ? (
            <>
              <SectionTitle>{t("shell.nav.group.shooting")}</SectionTitle>
              <Card className="animate-rise divide-y divide-line overflow-hidden">
                {ctx.hasModule("federal") ? <Row href="/federal" icon={<BadgeCheck className="h-4 w-4" />} label={t("shell.me.row.federal")} hint={t("shell.me.hint.federal")} /> : null}
                {ctx.hasModule("championship") ? <Row href="/championship" icon={<Trophy className="h-4 w-4" />} label={t("shell.me.row.championship")} /> : null}
                {canLive ? <Row href="/admin/live" icon={<Tv className="h-4 w-4" />} label={t("shell.me.row.live")} hint={t("shell.me.hint.live")} /> : null}
                {canScoreImport ? <Row href="/scores/import" icon={<FileInput className="h-4 w-4" />} label={t("shell.me.row.scoreImport")} hint={t("shell.me.hint.scoreImport")} /> : null}
              </Card>
            </>
          ) : null}
          {clubOn ? (
            <>
              <SectionTitle>{t("shell.nav.group.club")}</SectionTitle>
              <Card className="animate-rise divide-y divide-line overflow-hidden">
                {ctx.hasModule("range") ? <Row href="/range" icon={<DoorOpen className="h-4 w-4" />} label={t("shell.me.row.range")} hint={t("shell.me.hint.range")} /> : null}
                {ctx.hasModule("shifts") ? <Row href="/shifts" icon={<HandHelping className="h-4 w-4" />} label={t("shell.me.row.shifts")} hint={t("shell.me.hint.shifts")} /> : null}
                {ctx.hasModule("courses") ? <Row href="/courses" icon={<GraduationCap className="h-4 w-4" />} label={t("shell.me.row.courses")} /> : null}
                {canWeapons ? <Row href="/weapons" icon={<Shield className="h-4 w-4" />} label={t("shell.me.row.weapons")} /> : null}
                {kioskOn ? (
                  can("kiosk.sell")
                    ? <Row href="/kiosk" icon={<Coffee className="h-4 w-4" />} label={t("shell.me.row.kiosk")} hint={t("shell.me.hint.kiosk")} />
                    : <Row href="/kiosk/me" icon={<Coffee className="h-4 w-4" />} label={t("shell.me.row.kioskMe")} hint={t("shell.me.hint.kioskMe")} />
                ) : null}
              </Card>
            </>
          ) : null}
          {canManage || canManageAmmo || canViewMembers || canAudit || adminRange || adminShifts || adminQuali || adminAccounting || adminKiosk ? (
            <>
              <SectionTitle>{t("shell.nav.group.admin")}</SectionTitle>
              <Card className="animate-rise divide-y divide-line overflow-hidden">
                {canManage ? <Row href="/admin" icon={<Settings className="h-4 w-4" />} label={t("shell.me.row.admin")} /> : null}
                {canViewMembers ? <Row href="/admin/members" icon={<Users className="h-4 w-4" />} label={t("shell.me.row.adminMembers")} /> : null}
                {canManageMembers ? <Row href="/admin/members/invitations" icon={<Mail className="h-4 w-4" />} label={t("shell.me.row.adminInvite")} /> : null}
                {canManageMembers ? <Row href="/admin/members/import" icon={<FileUp className="h-4 w-4" />} label={t("shell.me.row.adminImport")} /> : null}
                {canManageMembers ? <Row href="/admin/members/households" icon={<Home className="h-4 w-4" />} label={t("shell.me.row.adminHouseholds")} /> : null}
                {canManage && paymentsOn ? <Row href="/admin/payments" icon={<Wallet className="h-4 w-4" />} label={t("shell.me.row.adminPayments")} /> : null}
                {canManage && ctx.hasModule("bookings") ? <Row href="/admin/bookings" icon={<CalendarDays className="h-4 w-4" />} label={t("shell.me.row.adminBookings")} /> : null}
                {canManage && ctx.hasModule("billing") ? <Row href="/admin/billing" icon={<CreditCard className="h-4 w-4" />} label={t("shell.me.row.adminBilling")} /> : null}
                {canManage && ctx.hasModule("files") ? <Row href="/admin/files" icon={<FolderOpen className="h-4 w-4" />} label={t("shell.me.row.adminFiles")} /> : null}
                {canManageAmmo && ctx.hasModule("ammo") ? <Row href="/admin/ammo" icon={<Package className="h-4 w-4" />} label={t("shell.me.row.adminAmmo")} /> : null}
                {adminStock ? <Row href="/admin/ammo/stock" icon={<Boxes className="h-4 w-4" />} label={t("shell.me.row.adminStock")} hint={t("shell.me.hint.adminStock")} /> : null}
                {adminRange ? <Row href="/admin/range" icon={<Clock className="h-4 w-4" />} label={t("shell.me.row.adminRange")} /> : null}
                {adminShifts ? <Row href="/admin/shifts" icon={<HandHelping className="h-4 w-4" />} label={t("shell.me.row.adminShifts")} /> : null}
                {adminQuali ? <Row href="/admin/qualifications" icon={<Award className="h-4 w-4" />} label={t("shell.me.row.adminQuali")} /> : null}
                {adminPartners ? <Row href="/admin/bookings/partners" icon={<Handshake className="h-4 w-4" />} label={t("shell.me.row.adminPartners")} hint={t("shell.me.hint.adminPartners")} /> : null}
                {adminKiosk ? <Row href="/admin/kiosk" icon={<Coffee className="h-4 w-4" />} label={t("shell.me.row.adminKiosk")} hint={t("shell.me.hint.adminKiosk")} /> : null}
                {adminAccounting ? <Row href="/admin/accounting" icon={<BookOpenCheck className="h-4 w-4" />} label={t("shell.me.row.adminAccounting")} hint={t("shell.me.hint.adminAccounting")} /> : null}
                {canManage ? <Row href="/admin/embed" icon={<Code2 className="h-4 w-4" />} label={t("shell.me.row.adminEmbed")} hint={t("shell.me.hint.adminEmbed")} /> : null}
                {canAudit ? <Row href="/admin/audit" icon={<History className="h-4 w-4" />} label={t("shell.me.row.adminAudit")} /> : null}
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      {ctx.user.isSuperAdmin ? (
        <>
          <SectionTitle>{t("shell.me.superAdmin")}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            <Row href="/super" icon={<Shield className="h-4 w-4" />} label={t("shell.me.row.super")} />
            <Row href="/super/system" icon={<Server className="h-4 w-4" />} label={t("shell.me.row.system")} />
          </Card>
        </>
      ) : null}

      <SectionTitle>{t("shell.me.account")}</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        <Row href="/me/security" icon={<ShieldCheck className="h-4 w-4" />} label={t("shell.me.row.security")} hint={t("shell.me.hint.security")} />
        <Row href="/me/notifications" icon={<Bell className="h-4 w-4" />} label={t("shell.me.row.notifications")} />
        <Row href="/me/privacy" icon={<KeyRound className="h-4 w-4" />} label={t("shell.me.row.privacy")} hint={t("shell.me.hint.privacy")} />
      </Card>

      <SectionTitle>{t("shell.me.avatar")}</SectionTitle>
      <AvatarCard name={ctx.user.name} avatarUrl={ctx.user.avatarUrl} title={t("shell.me.avatar")} />

      <SectionTitle>{t("shell.me.profile")}</SectionTitle>
      <ProfileForm
        today={todayZurich()}
        profile={{ name: ctx.user.name, phone: profile.phone, birthDate: dateOnly(profile.birthDate), street: ctx.user.street, zip: ctx.user.zip, city: ctx.user.city }}
      />

      <SectionTitle>{t("shell.me.theme")}</SectionTitle>
      <ThemePicker value={ctx.user.themePref} />

      <SectionTitle>{t("shell.me.myData")}</SectionTitle>
      <Card className="animate-rise overflow-hidden">
        <dl className="divide-y divide-line text-sm">
          <DataRow label={t("shell.common.name")} value={ctx.user.name} />
          <DataRow label={t("shell.common.email")} value={ctx.user.email} />
          <DataRow label={t("shell.me.address")} value={[ctx.user.street, [ctx.user.zip, ctx.user.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "–"} />
          <DataRow label={t("shell.me.phone")} value={profile.phone || "–"} />
          <DataRow label={t("shell.me.birthDate")} value={formatIso(dateOnly(profile.birthDate), locale)} />
        </dl>
      </Card>
      {memberships.length ? (
        <Card className="animate-rise mt-2.5 divide-y divide-line overflow-hidden">
          {memberships.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <TenantLogo src={tenantLogoUrl(m.tenant)} size={40} />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{m.tenant.name}</div>
                <div className="text-xs text-ink-3 truncate">
                  {m.status === "LEFT"
                    ? t("members.status.LEFT")
                    : m.status === "PENDING"
                      ? t("shell.me.pendingApproval")
                      : t("shell.me.memberSince", { date: formatDate(m.joinedAt ?? m.createdAt, locale) })}
                  {m.memberNumber ? ` · ${t("shell.me.memberNumber", { number: m.memberNumber })}` : ""}
                  {m.tenant.city ? ` · ${m.tenant.city}` : ""}
                  {` · ${t(m.tenant._count.memberships === 1 ? "shell.me.membersOne" : "shell.me.membersMany", { count: m.tenant._count.memberships })}`}
                </div>
              </div>
              {m.status === "LEFT" || m.status === "PENDING" ? <Badge tone={m.status === "PENDING" ? "warn" : "outline"}>{labelOr(t, `members.status.${m.status}`, m.status === "PENDING" ? t("shell.me.pendingShort") : m.status)}</Badge> : <Badge tone={m.role === "OWNER" || m.role === "ADMIN" ? "accent" : "neutral"}>{roleLabel(m.role)}</Badge>}
            </div>
          ))}
        </Card>
      ) : (
        <p className="mt-2.5 text-sm text-ink-3">{t("shell.me.noClub")}</p>
      )}

      <form action={logoutAction} className="mt-8">
        <button type="submit" className="press w-full h-11 rounded-control border border-line text-ink-2 inline-flex items-center justify-center gap-2 hover:bg-surface-2">
          <LogOut className="h-4 w-4" /> {t("shell.me.logout")}
        </button>
      </form>
      <p className="text-center text-xs text-ink-3 mt-6">{t("shell.me.version", { version: "0.2" })}</p>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <dt className="w-24 shrink-0 text-ink-3">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{value}</dd>
    </div>
  );
}

function Row({ href, icon, label, hint }: { href: string; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <Link href={href} className="flex min-h-13 items-center gap-3 px-4 py-2 hover:bg-surface-2 transition-colors">
      <span className="text-ink-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {hint ? <span className="block text-xs text-ink-3">{hint}</span> : null}
      </span>
      <ChevronRight className="h-4 w-4 text-ink-3" />
    </Link>
  );
}
