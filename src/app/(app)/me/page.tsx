import type { Metadata } from "next";
import Link from "next/link";
import { BookUser, CalendarDays, ChevronRight, CreditCard, LogOut, Settings, Shield, Users, BarChart3 } from "lucide-react";
import { getAppContext } from "@/lib/tenant";
import { db } from "@/lib/db";
import { logoutAction } from "@/modules/core/auth-actions";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { Avatar, tenantLogoUrl } from "@/components/avatar";
import { TenantLogo } from "@/components/logo";
import { ROLE_LABELS, type TenantRole } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { AvatarCard, PasswordForm, ProfileForm, TenantSwitcher, ThemePicker } from "./forms";

export const metadata: Metadata = { title: "Mehr" };

const roleLabel = (r: string) => ROLE_LABELS[r as TenantRole] ?? r;

export default async function MePage() {
  const ctx = await getAppContext();
  const canManage = ctx.tenant ? ctx.can("tenant.manage") : false;

  const memberships = await db.membership.findMany({
    where: { userId: ctx.user.id },
    select: {
      id: true,
      role: true,
      memberNumber: true,
      createdAt: true,
      tenant: { select: { id: true, name: true, kind: true, city: true, logoPath: true, updatedAt: true, _count: { select: { memberships: true } } } },
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
            <Row href="/members" icon={<BookUser className="h-4 w-4" />} label="Mitgliederverzeichnis" />
            {ctx.hasModule("scores") ? <Row href="/scores/stats" icon={<BarChart3 className="h-4 w-4" />} label="Meine Statistik" /> : null}
            {ctx.hasModule("bookings") ? <Row href="/bookings" icon={<CalendarDays className="h-4 w-4" />} label="Reservationen" /> : null}
            {ctx.hasModule("billing") ? <Row href="/billing" icon={<CreditCard className="h-4 w-4" />} label="Meine Beiträge" /> : null}
            {canManage ? <Row href="/admin" icon={<Settings className="h-4 w-4" />} label="Einstellungen, Logo & Farben" /> : null}
            {canManage ? <Row href="/admin/members" icon={<Users className="h-4 w-4" />} label="Mitglieder & Rollen" /> : null}
            {canManage && ctx.hasModule("bookings") ? <Row href="/admin/bookings" icon={<CalendarDays className="h-4 w-4" />} label="Reservationen verwalten" /> : null}
            {canManage && ctx.hasModule("billing") ? <Row href="/admin/billing" icon={<CreditCard className="h-4 w-4" />} label="Mitgliederbeiträge verwalten" /> : null}
          </Card>
        </>
      ) : null}

      {ctx.user.isSuperAdmin ? (
        <>
          <SectionTitle>Super-Admin</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            <Row href="/super" icon={<Shield className="h-4 w-4" />} label="Globale Verwaltung" />
          </Card>
        </>
      ) : null}

      <SectionTitle>Profilbild</SectionTitle>
      <AvatarCard name={ctx.user.name} avatarUrl={ctx.user.avatarUrl} />

      <SectionTitle>Profil</SectionTitle>
      <ProfileForm name={ctx.user.name} address={{ street: ctx.user.street, zip: ctx.user.zip, city: ctx.user.city }} />

      <SectionTitle>Darstellung</SectionTitle>
      <ThemePicker value={ctx.user.themePref} />

      <SectionTitle>Passwort ändern</SectionTitle>
      <PasswordForm />

      <SectionTitle>Meine Daten</SectionTitle>
      <Card className="animate-rise overflow-hidden">
        <dl className="divide-y divide-line text-sm">
          <DataRow label="Name" value={ctx.user.name} />
          <DataRow label="E-Mail" value={ctx.user.email} />
          <DataRow label="Adresse" value={[ctx.user.street, [ctx.user.zip, ctx.user.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "–"} />
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
                  Mitglied seit {formatDate(m.createdAt)}
                  {m.memberNumber ? ` · Nr. ${m.memberNumber}` : ""}
                  {m.tenant.city ? ` · ${m.tenant.city}` : ""}
                  {` · ${m.tenant._count.memberships} Mitglieder`}
                </div>
              </div>
              <Badge tone={m.role === "OWNER" || m.role === "ADMIN" ? "accent" : "neutral"}>{roleLabel(m.role)}</Badge>
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

function Row({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 h-13 hover:bg-surface-2 transition-colors">
      <span className="text-ink-2">{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      <ChevronRight className="h-4 w-4 text-ink-3" />
    </Link>
  );
}
