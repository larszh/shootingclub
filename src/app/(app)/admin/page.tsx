import type { Metadata } from "next";
import { getRequestLocale, getT } from "@/lib/i18n";
import Link from "next/link";
import { Award, BookOpenCheck, Boxes, CalendarDays, ClipboardList, Clock, Code2, Coffee, CreditCard, FileInput, FileUp, FolderOpen, Handshake, HandHelping, History, Home, Landmark, Mail, Megaphone, Package, Server, Settings2, Shield, Trophy, Tv, UserPlus, Users, Wallet } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { MODULES } from "@/lib/modules";
import { db } from "@/lib/db";
import { accessStatusWhere } from "@/lib/membership-access";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { tenantLogoUrl } from "@/components/avatar";
import { BrandingForm, JoinCodeCard, ModuleToggle, TenantSettingsForm } from "./forms";
import { TwoFactorHint } from "../me/security/hint";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.home.title") };
}

export default async function AdminPage() {
  const ctx = await requirePermission("tenant.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: ctx.tenant.id }, include: { _count: { select: { memberships: { where: { status: accessStatusWhere() } } } } } });
  const base = process.env.APP_URL ?? "";
  const pendingRequests = ctx.can("members.approve")
    ? await db.membership.count({ where: { tenantId: ctx.tenant.id, status: "PENDING", user: { deletedAt: null } } })
    : null;

  return (
    <div>
      <PageHeader title={t("adm1.home.title")} subtitle={tenant.name} back={{ href: "/me", label: t("adm1.home.more") }} />
      <TwoFactorHint className="mb-4" />

      <SectionTitle>{t("adm1.home.invite")}</SectionTitle>
      <JoinCodeCard locale={locale} code={tenant.joinCode} link={`${base}/register?code=${tenant.joinCode}`} />
      {pendingRequests !== null ? (
        <AdminRow href="/admin/members/requests" icon={<UserPlus className="h-5 w-5 text-ink-2" aria-hidden />} label={t("adm1.home.requests")}
          hint={`${t(tenant.joinApproval ? "adm1.home.approvalOn" : "adm1.home.approvalOff")}${pendingRequests ? ` · ${t(pendingRequests === 1 ? "adm1.home.requestsWaiting.one" : "adm1.home.requestsWaiting.other", { n: pendingRequests })}` : ""}`} />
      ) : null}
      <Link href="/admin/members" className="block press mt-2.5">
        <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><Users className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">{t("adm1.home.membersRoles")}</span><span className="text-sm text-ink-3">{tenant._count.memberships}</span></Card>
      </Link>
      {ctx.can("members.manage") ? (
        <div className="mt-2.5 grid grid-cols-3 gap-2.5">
          <AdminTile href="/admin/members/invitations" icon={<Mail className="h-5 w-5" aria-hidden />} label={t("adm1.home.inviteTile")} />
          <AdminTile href="/admin/members/import" icon={<FileUp className="h-5 w-5" aria-hidden />} label={t("adm1.home.import")} />
          <AdminTile href="/admin/members/households" icon={<Home className="h-5 w-5" aria-hidden />} label={t("adm1.home.households")} />
        </div>
      ) : null}
      {ctx.hasModule("events") ? (
        <Link href="/admin/events" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><Megaphone className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">{t("adm1.home.events")}</span></Card>
        </Link>
      ) : null}
      {ctx.hasModule("bookings") ? (
        <Link href="/admin/bookings" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><CalendarDays className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">{t("adm1.home.bookings")}</span></Card>
        </Link>
      ) : null}
      {ctx.hasModule("bookings") ? (
        <AdminRow href="/admin/bookings/partners" icon={<Handshake className="h-5 w-5 text-ink-2" aria-hidden />} label={t("adm1.home.partners")} hint={t("adm1.home.partnersHint")} />
      ) : null}
      {ctx.hasModule("billing") ? (
        <Link href="/admin/billing" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><CreditCard className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">{t("adm1.home.billing")}</span></Card>
        </Link>
      ) : null}

      {ctx.hasModule("billing") || ctx.hasModule("bookings") || ctx.hasModule("ammo") ? (
        <Link href="/admin/payments" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><Wallet className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">{t("adm1.home.payments")}</span></Card>
        </Link>
      ) : null}
      {ctx.hasModule("files") ? (
        <Link href="/admin/files" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><FolderOpen className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">{t("adm1.home.files")}</span></Card>
        </Link>
      ) : null}
      {ctx.hasModule("ammo") ? (
        <Link href="/admin/ammo" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><Package className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">{t("adm1.home.ammo")}</span></Card>
        </Link>
      ) : null}

      {ctx.hasModule("ammo") && ctx.can("ammo.manage") ? (
        <AdminRow href="/admin/ammo/stock" icon={<Boxes className="h-5 w-5 text-ink-2" aria-hidden />} label={t("adm1.home.ammoStock")} hint={t("adm1.home.ammoStockHint")} />
      ) : null}
      {ctx.hasModule("kiosk") && ctx.can("kiosk.manage") ? (
        <AdminRow href="/admin/kiosk" icon={<Coffee className="h-5 w-5 text-ink-2" aria-hidden />} label={t("adm1.home.kiosk")} hint={t("adm1.home.kioskHint")} />
      ) : null}
      {ctx.can("accounting.export") ? (
        <AdminRow href="/admin/accounting" icon={<BookOpenCheck className="h-5 w-5 text-ink-2" aria-hidden />} label={t("adm1.home.accounting")} hint={t("adm1.home.accountingHint")} />
      ) : null}
      <AdminRow href="/admin/embed" icon={<Code2 className="h-5 w-5 text-ink-2" aria-hidden />} label={t("adm1.home.embed")} hint={t("adm1.home.embedHint")} />
      <AdminRow href="/admin/association" icon={<Landmark className="h-5 w-5 text-ink-2" aria-hidden />} label={t("adm1.home.association")} hint={t("adm1.home.associationHint")} />
      {ctx.hasModule("weapons") && ctx.can("weapons.manage") ? (
        <AdminRow href="/admin/weapons/settings" icon={<Shield className="h-5 w-5 text-ink-2" aria-hidden />} label={t("adm1.home.weapons")} hint={t("adm1.home.weaponsHint")} />
      ) : null}

      {ctx.hasModule("range") && ctx.can("range.manage") ? (
        <>
          <SectionTitle>{t("adm1.home.range")}</SectionTitle>
          <div className="grid grid-cols-3 gap-2.5">
            <AdminTile href="/admin/range" icon={<Settings2 className="h-5 w-5" aria-hidden />} label={t("adm1.home.rangeOverview")} />
            <AdminTile href="/admin/range/rules" icon={<ClipboardList className="h-5 w-5" aria-hidden />} label={t("adm1.home.rangeRules")} />
            <AdminTile href="/admin/range/times" icon={<Clock className="h-5 w-5" aria-hidden />} label={t("adm1.home.rangeTimes")} />
          </div>
        </>
      ) : null}

      {(ctx.hasModule("shifts") && ctx.can("shifts.manage")) || ctx.can("qualifications.manage") || (ctx.hasModule("scores") && (ctx.can("match.viewAll") || ctx.can("events.manage") || ctx.can("tenant.programs.manage"))) || (ctx.hasModule("championship") && ctx.can("championship.manage")) ? (
        <SectionTitle>{t("adm1.home.helpers")}</SectionTitle>
      ) : null}
      {ctx.hasModule("shifts") && ctx.can("shifts.manage") ? (
        <>
          <AdminRow href="/admin/shifts" icon={<HandHelping className="h-5 w-5 text-ink-2" aria-hidden />} label={t("adm1.home.shifts")} />
          <AdminRow href="/admin/shifts/settings" icon={<Settings2 className="h-5 w-5 text-ink-2" aria-hidden />} label={t("adm1.home.shiftSettings")} hint={t("adm1.home.title")} />
        </>
      ) : null}
      {ctx.can("qualifications.manage") ? (
        <AdminRow href="/admin/qualifications" icon={<Award className="h-5 w-5 text-ink-2" aria-hidden />} label={t("adm1.home.qualifications")} hint={t("adm1.home.qualificationsHint")} />
      ) : null}
      {ctx.hasModule("championship") && ctx.can("championship.manage") ? (
        <AdminRow href="/championship" icon={<Trophy className="h-5 w-5 text-ink-2" aria-hidden />} label={t("adm1.home.championship")} />
      ) : null}
      {ctx.hasModule("scores") && (ctx.can("match.viewAll") || ctx.can("events.manage")) ? (
        <AdminRow href="/admin/live" icon={<Tv className="h-5 w-5 text-ink-2" aria-hidden />} label={t("adm1.home.live")} hint={t("adm1.home.liveHint")} />
      ) : null}
      {ctx.hasModule("scores") && (ctx.can("match.viewAll") || ctx.can("tenant.programs.manage")) ? (
        <AdminRow href="/scores/import" icon={<FileInput className="h-5 w-5 text-ink-2" aria-hidden />} label={t("adm1.home.scoreImport")} hint="Meyton, SIUS, ShotMarker, CSV" />
      ) : null}

      {ctx.can("audit.view") ? (
        <Link href="/admin/audit" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><History className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">{t("adm1.home.audit")}</span><span className="text-sm text-ink-3">{t("adm1.home.auditHint")}</span></Card>
        </Link>
      ) : null}
      {ctx.user.isSuperAdmin ? (
        <Link href="/super/system" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><Server className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">{t("adm1.home.system")}</span><span className="text-sm text-ink-3">Super-Admin</span></Card>
        </Link>
      ) : null}

      <SectionTitle>{t("adm1.home.modules")}</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {MODULES.map((m) => (
          <ModuleToggle key={m.key} locale={locale} moduleKey={m.key} name={t(`adm1.module.${m.key}.name`)} description={t(`adm1.module.${m.key}.desc`)} enabled={ctx.hasModule(m.key)} planned={m.status === "planned"} />
        ))}
      </Card>

      <SectionTitle>{t("adm1.home.branding")}</SectionTitle>
      <BrandingForm locale={locale} tenantName={tenant.name} logoUrl={tenantLogoUrl(tenant)} brandColor={tenant.brandColor} brandColor2={tenant.brandColor2} />

      <SectionTitle>{t("adm1.home.masterData")}</SectionTitle>
      <TenantSettingsForm locale={locale} tenant={{ name: tenant.name, kind: tenant.kind, city: tenant.city, canton: tenant.canton, description: tenant.description, website: tenant.website, defaultLocale: tenant.defaultLocale, replyToEmail: tenant.replyToEmail }} />
    </div>
  );
}

function AdminRow({ href, icon, label, hint }: { href: string; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <Link href={href} className="block press mt-2.5">
      <Card className="p-4 flex items-center gap-3 hover:border-ink/30">{icon}<span className="flex-1 font-medium">{label}</span>{hint ? <span className="text-sm text-ink-3">{hint}</span> : null}</Card>
    </Link>
  );
}

function AdminTile({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="block press">
      <Card className="flex min-h-20 flex-col items-center justify-center gap-1.5 p-3 text-center hover:border-ink/30">
        <span className="text-ink-2">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </Card>
    </Link>
  );
}
