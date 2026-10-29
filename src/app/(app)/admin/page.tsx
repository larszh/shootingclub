import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CreditCard, FileUp, FolderOpen, History, Home, Mail, Megaphone, Package, Server, Users, Wallet } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { MODULES } from "@/lib/modules";
import { db } from "@/lib/db";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { tenantLogoUrl } from "@/components/avatar";
import { BrandingForm, JoinCodeCard, ModuleToggle, TenantSettingsForm } from "./forms";
import { TwoFactorHint } from "../me/security/hint";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function AdminPage() {
  const ctx = await requirePermission("tenant.manage");
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: ctx.tenant.id }, include: { _count: { select: { memberships: { where: { status: { not: "LEFT" } } } } } } });
  const base = process.env.APP_URL ?? "";

  return (
    <div>
      <PageHeader title="Einstellungen" subtitle={tenant.name} back={{ href: "/me", label: "Mehr" }} />
      <TwoFactorHint className="mb-4" />

      <SectionTitle>Mitglieder einladen</SectionTitle>
      <JoinCodeCard code={tenant.joinCode} link={`${base}/register?code=${tenant.joinCode}`} />
      <Link href="/admin/members" className="block press mt-2.5">
        <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><Users className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">Mitglieder & Rollen</span><span className="text-sm text-ink-3">{tenant._count.memberships}</span></Card>
      </Link>
      {ctx.can("members.manage") ? (
        <div className="mt-2.5 grid grid-cols-3 gap-2.5">
          <AdminTile href="/admin/members/invitations" icon={<Mail className="h-5 w-5" aria-hidden />} label="Einladen" />
          <AdminTile href="/admin/members/import" icon={<FileUp className="h-5 w-5" aria-hidden />} label="Import" />
          <AdminTile href="/admin/members/households" icon={<Home className="h-5 w-5" aria-hidden />} label="Haushalte" />
        </div>
      ) : null}
      {ctx.hasModule("events") ? (
        <Link href="/admin/events" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><Megaphone className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">Anlässe & Mitteilungen</span></Card>
        </Link>
      ) : null}
      {ctx.hasModule("bookings") ? (
        <Link href="/admin/bookings" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><CalendarDays className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">Reservationen verwalten</span></Card>
        </Link>
      ) : null}
      {ctx.hasModule("billing") ? (
        <Link href="/admin/billing" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><CreditCard className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">Mitgliederbeiträge verwalten</span></Card>
        </Link>
      ) : null}

      {ctx.hasModule("billing") || ctx.hasModule("bookings") || ctx.hasModule("ammo") ? (
        <Link href="/admin/payments" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><Wallet className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">Offene Posten</span></Card>
        </Link>
      ) : null}
      {ctx.hasModule("files") ? (
        <Link href="/admin/files" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><FolderOpen className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">Dateiablage & Speicherort</span></Card>
        </Link>
      ) : null}
      {ctx.hasModule("ammo") ? (
        <Link href="/admin/ammo" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><Package className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">Munition verwalten</span></Card>
        </Link>
      ) : null}

      {ctx.can("audit.view") ? (
        <Link href="/admin/audit" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><History className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">Protokoll</span><span className="text-sm text-ink-3">Wer hat was geändert</span></Card>
        </Link>
      ) : null}
      {ctx.user.isSuperAdmin ? (
        <Link href="/super/system" className="block press mt-2.5">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><Server className="h-5 w-5 text-ink-2" aria-hidden /><span className="flex-1 font-medium">System</span><span className="text-sm text-ink-3">Super-Admin</span></Card>
        </Link>
      ) : null}

      <SectionTitle>Module</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {MODULES.map((m) => (
          <ModuleToggle key={m.key} moduleKey={m.key} name={m.name} description={m.description} enabled={ctx.hasModule(m.key)} planned={m.status === "planned"} />
        ))}
      </Card>

      <SectionTitle>Erscheinungsbild</SectionTitle>
      <BrandingForm tenantName={tenant.name} logoUrl={tenantLogoUrl(tenant)} brandColor={tenant.brandColor} brandColor2={tenant.brandColor2} />

      <SectionTitle>Stammdaten</SectionTitle>
      <TenantSettingsForm tenant={{ name: tenant.name, kind: tenant.kind, city: tenant.city, canton: tenant.canton, description: tenant.description, website: tenant.website }} />
    </div>
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
