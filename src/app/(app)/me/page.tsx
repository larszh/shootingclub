import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LogOut, Settings, Shield, Users, BarChart3 } from "lucide-react";
import { getAppContext } from "@/lib/tenant";
import { logoutAction } from "@/modules/core/auth-actions";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { ROLE_LABELS, type TenantRole } from "@/lib/permissions";
import { ProfileForm, TenantSwitcher } from "./forms";

export const metadata: Metadata = { title: "Mehr" };

export default async function MePage() {
  const ctx = await getAppContext();
  const canManage = ctx.tenant ? ctx.can("tenant.manage") : false;

  return (
    <div>
      <PageHeader title={ctx.user.name} subtitle={ctx.user.email} />

      <SectionTitle>Verein / Anlage</SectionTitle>
      <TenantSwitcher activeId={ctx.tenant?.id ?? null} tenants={ctx.user.memberships.map((m) => ({ id: m.tenantId, name: m.tenant.name, role: ROLE_LABELS[m.role as TenantRole] ?? m.role }))} />

      {ctx.tenant ? (
        <>
          <SectionTitle>{ctx.tenant.name}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            <Row href="/scores/stats" icon={<BarChart3 className="h-4 w-4" />} label="Meine Statistik" />
            {canManage ? <Row href="/admin" icon={<Settings className="h-4 w-4" />} label="Einstellungen & Module" /> : null}
            {canManage ? <Row href="/admin/members" icon={<Users className="h-4 w-4" />} label="Mitglieder & Rollen" /> : null}
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

      <SectionTitle>Profil</SectionTitle>
      <ProfileForm name={ctx.user.name} />

      <form action={logoutAction} className="mt-8">
        <button type="submit" className="press w-full h-11 rounded-control border border-line text-ink-2 inline-flex items-center justify-center gap-2 hover:bg-surface-2">
          <LogOut className="h-4 w-4" /> Abmelden
        </button>
      </form>
      <p className="text-center text-xs text-ink-3 mt-6">Mouche · Version 0.1</p>
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
