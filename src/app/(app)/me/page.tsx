import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BookUser, CalendarDays, ChevronRight, CreditCard, FileUp, FolderOpen, History, Home, KeyRound, LogOut, Mail, Megaphone, MessageCircle, Package, Server, Settings, Shield, ShieldCheck, Target, Users, BarChart3, Wallet } from "lucide-react";
import { getAppContext } from "@/lib/tenant";
import { db } from "@/lib/db";
import { logoutAction } from "@/modules/core/auth-actions";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { Avatar, tenantLogoUrl } from "@/components/avatar";
import { TenantLogo } from "@/components/logo";
import { ROLE_LABELS, type TenantRole } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { todayZurich } from "@/lib/time";
import { dateOnly, formatIsoDate, statusLabel } from "@/modules/members/types";
import { AvatarCard, ProfileForm, TenantSwitcher, ThemePicker } from "./forms";

export const metadata: Metadata = { title: "Mehr" };

const roleLabel = (r: string) => ROLE_LABELS[r as TenantRole] ?? r;

export default async function MePage() {
  const ctx = await getAppContext();
  const canManage = ctx.tenant ? ctx.can("tenant.manage") : false;
  const canManageAmmo = ctx.tenant ? ctx.can("ammo.manage") : false;
  const canViewMembers = ctx.tenant ? ctx.can("members.view") : false;
  const canManageMembers = ctx.tenant ? ctx.can("members.manage") : false;
  const canAudit = ctx.tenant ? ctx.can("audit.view") : false;
  const paymentsOn = ctx.hasModule("billing") || ctx.hasModule("bookings") || ctx.hasModule("ammo");

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
      tenant: { select: { id: true, name: true, kind: true, city: true, logoPath: true, updatedAt: true, _count: { select: { memberships: { where: { status: { not: "LEFT" } } } } } } },
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

      <SectionTitle>Verein / Anlage</SectionTitle>
      <TenantSwitcher
        activeId={ctx.tenant?.id ?? null}
        tenants={ctx.user.memberships.map((m) => ({ id: m.tenantId, name: m.tenant.name, role: roleLabel(m.role), logoUrl: tenantLogoUrl(m.tenant) }))}
      />

      {ctx.tenant ? (
        <>
          <SectionTitle>{ctx.tenant.name}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {/* Alle Module, auch die, die mobil nicht in die Tableiste passen */}
            {ctx.hasModule("chat") ? <Row href="/chat" icon={<MessageCircle className="h-4 w-4" />} label="Chat" /> : null}
            {ctx.hasModule("events") ? <Row href="/events" icon={<Megaphone className="h-4 w-4" />} label="Anlässe & News" /> : null}
            {ctx.hasModule("bookings") ? <Row href="/bookings" icon={<CalendarDays className="h-4 w-4" />} label="Reservationen" /> : null}
            {ctx.hasModule("targets") ? <Row href="/targets" icon={<Target className="h-4 w-4" />} label="Zielscheiben drucken" /> : null}
            {ctx.hasModule("files") ? <Row href="/files" icon={<FolderOpen className="h-4 w-4" />} label="Dateiablage" /> : null}
            {ctx.hasModule("ammo") ? <Row href="/ammo" icon={<Package className="h-4 w-4" />} label="Munition bestellen" /> : null}
            {paymentsOn ? <Row href="/payments" icon={<Wallet className="h-4 w-4" />} label="Meine Zahlungen" /> : null}
            {ctx.hasModule("billing") ? <Row href="/billing" icon={<CreditCard className="h-4 w-4" />} label="Meine Beiträge" /> : null}
            {ctx.hasModule("scores") ? <Row href="/scores/stats" icon={<BarChart3 className="h-4 w-4" />} label="Meine Statistik" /> : null}
            <Row href="/members" icon={<BookUser className="h-4 w-4" />} label="Mitgliederverzeichnis" />
          </Card>
          {canManage || canManageAmmo || canViewMembers || canAudit ? (
            <>
              <SectionTitle>Verwaltung</SectionTitle>
              <Card className="animate-rise divide-y divide-line overflow-hidden">
                {canManage ? <Row href="/admin" icon={<Settings className="h-4 w-4" />} label="Einstellungen, Logo & Farben" /> : null}
                {canViewMembers ? <Row href="/admin/members" icon={<Users className="h-4 w-4" />} label="Mitglieder & Rollen" /> : null}
                {canManageMembers ? <Row href="/admin/members/invitations" icon={<Mail className="h-4 w-4" />} label="Mitglieder einladen" /> : null}
                {canManageMembers ? <Row href="/admin/members/import" icon={<FileUp className="h-4 w-4" />} label="Mitglieder importieren" /> : null}
                {canManageMembers ? <Row href="/admin/members/households" icon={<Home className="h-4 w-4" />} label="Haushalte" /> : null}
                {canManage && paymentsOn ? <Row href="/admin/payments" icon={<Wallet className="h-4 w-4" />} label="Offene Posten" /> : null}
                {canManage && ctx.hasModule("bookings") ? <Row href="/admin/bookings" icon={<CalendarDays className="h-4 w-4" />} label="Reservationen verwalten" /> : null}
                {canManage && ctx.hasModule("billing") ? <Row href="/admin/billing" icon={<CreditCard className="h-4 w-4" />} label="Mitgliederbeiträge verwalten" /> : null}
                {canManage && ctx.hasModule("files") ? <Row href="/admin/files" icon={<FolderOpen className="h-4 w-4" />} label="Dateiablage & Speicherort" /> : null}
                {canManageAmmo && ctx.hasModule("ammo") ? <Row href="/admin/ammo" icon={<Package className="h-4 w-4" />} label="Munition verwalten" /> : null}
                {canAudit ? <Row href="/admin/audit" icon={<History className="h-4 w-4" />} label="Protokoll" /> : null}
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      {ctx.user.isSuperAdmin ? (
        <>
          <SectionTitle>Super-Admin</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            <Row href="/super" icon={<Shield className="h-4 w-4" />} label="Globale Verwaltung" />
            <Row href="/super/system" icon={<Server className="h-4 w-4" />} label="System" />
          </Card>
        </>
      ) : null}

      <SectionTitle>Konto</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        <Row href="/me/security" icon={<ShieldCheck className="h-4 w-4" />} label="Sicherheit" hint="Passwort, Zwei-Faktor, Geräte" />
        <Row href="/me/notifications" icon={<Bell className="h-4 w-4" />} label="Benachrichtigungen & Sprache" />
        <Row href="/me/privacy" icon={<KeyRound className="h-4 w-4" />} label="Datenschutz" hint="Daten herunterladen, Konto löschen" />
      </Card>

      <SectionTitle>Profilbild</SectionTitle>
      <AvatarCard name={ctx.user.name} avatarUrl={ctx.user.avatarUrl} />

      <SectionTitle>Profil</SectionTitle>
      <ProfileForm
        today={todayZurich()}
        profile={{ name: ctx.user.name, phone: profile.phone, birthDate: dateOnly(profile.birthDate), street: ctx.user.street, zip: ctx.user.zip, city: ctx.user.city }}
      />

      <SectionTitle>Darstellung</SectionTitle>
      <ThemePicker value={ctx.user.themePref} />

      <SectionTitle>Meine Daten</SectionTitle>
      <Card className="animate-rise overflow-hidden">
        <dl className="divide-y divide-line text-sm">
          <DataRow label="Name" value={ctx.user.name} />
          <DataRow label="E-Mail" value={ctx.user.email} />
          <DataRow label="Adresse" value={[ctx.user.street, [ctx.user.zip, ctx.user.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "–"} />
          <DataRow label="Telefon" value={profile.phone || "–"} />
          <DataRow label="Geburtsdatum" value={formatIsoDate(dateOnly(profile.birthDate))} />
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
                  {m.status === "LEFT" ? "Ausgetreten" : `Mitglied seit ${formatDate(m.joinedAt ?? m.createdAt)}`}
                  {m.memberNumber ? ` · Nr. ${m.memberNumber}` : ""}
                  {m.tenant.city ? ` · ${m.tenant.city}` : ""}
                  {` · ${m.tenant._count.memberships} Mitglieder`}
                </div>
              </div>
              {m.status === "LEFT" ? <Badge tone="outline">{statusLabel(m.status)}</Badge> : <Badge tone={m.role === "OWNER" || m.role === "ADMIN" ? "accent" : "neutral"}>{roleLabel(m.role)}</Badge>}
            </div>
          ))}
        </Card>
      ) : (
        <p className="mt-2.5 text-sm text-ink-3">Du bist noch in keinem Verein.</p>
      )}

      <form action={logoutAction} className="mt-8">
        <button type="submit" className="press w-full h-11 rounded-control border border-line text-ink-2 inline-flex items-center justify-center gap-2 hover:bg-surface-2">
          <LogOut className="h-4 w-4" /> Abmelden
        </button>
      </form>
      <p className="text-center text-xs text-ink-3 mt-6">Standchef · Version 0.2</p>
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
