import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Download, HandHelping, Plus, Wrench } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, LinkTabs, PageHeader, StatCard } from "@/components/ui";
import { formatDateZurich } from "@/lib/time";
import { requireWeapons } from "@/modules/weapons/guard";
import { defaultMinorReportDays, listDisciplines, listWeapons, memberOptions, weaponStats, type WeaponFilter, type WeaponListItem } from "@/modules/weapons/queries";
import { listAvailableWeapons } from "@/modules/weapons/service";
import { isWeaponStatus, weaponStatusInfo } from "@/modules/weapons/types";
import { WeaponFilters } from "@/modules/weapons/ui/filters";
import { LendButton } from "@/modules/weapons/ui/lend-dialog";

export const metadata: Metadata = { title: "Vereinswaffen" };

const fmt = (n: number) => new Intl.NumberFormat("de-CH").format(n);

export default async function WeaponsPage({ searchParams }: { searchParams: Promise<{ status?: string; discipline?: string; q?: string; denied?: string }> }) {
  const ctx = await requireWeapons();
  const sp = await searchParams;
  const canManage = ctx.can("weapons.manage");
  const status: WeaponFilter["status"] = sp.status === "all" || sp.status === "due" ? sp.status : sp.status && isWeaponStatus(sp.status) ? sp.status : "active";
  const filter: WeaponFilter = { status, discipline: sp.discipline?.slice(0, 191) || undefined, q: sp.q?.slice(0, 100) || undefined };
  const tenantId = ctx.tenant.id;
  const [weapons, stats, disciplines, available, members, reportDays] = await Promise.all([
    listWeapons(tenantId, filter, canManage),
    weaponStats(tenantId),
    listDisciplines(tenantId),
    listAvailableWeapons(tenantId),
    memberOptions(tenantId),
    defaultMinorReportDays(tenantId),
  ]);

  const qs = (s: string) => {
    const p = new URLSearchParams();
    if (s !== "active") p.set("status", s);
    if (filter.discipline) p.set("discipline", filter.discipline);
    if (filter.q) p.set("q", filter.q);
    return `/weapons${p.size ? `?${p}` : ""}`;
  };
  const tabs = [
    { value: "active", label: "Alle aktiven", href: qs("active") },
    { value: "AVAILABLE", label: "Verfügbar", href: qs("AVAILABLE"), count: stats.available },
    { value: "LOANED", label: "Ausgeliehen", href: qs("LOANED"), count: stats.loaned },
    { value: "due", label: "Wartung fällig", href: qs("due"), count: stats.serviceDue },
    { value: "SERVICE", label: "In Wartung", href: qs("SERVICE") },
    { value: "BLOCKED", label: "Gesperrt", href: qs("BLOCKED") },
    { value: "RETIRED", label: "Ausgemustert", href: qs("RETIRED") },
  ];

  return (
    <div>
      <PageHeader
        title="Vereinswaffen"
        subtitle={`${stats.total} ${stats.total === 1 ? "Waffe" : "Waffen"} im Inventar`}
        action={canManage ? <LinkButton href="/weapons/new" size="md"><Plus className="h-4 w-4" /> Erfassen</LinkButton> : undefined}
      />
      {sp.denied ? <Alert className="mb-4">Dafür fehlt dir die Berechtigung (Waffenverantwortliche).</Alert> : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Verfügbar" value={stats.available} tone="ok" href="/weapons?status=AVAILABLE" />
        <StatCard label="Ausgeliehen" value={stats.loaned} href="/weapons/loans" hint={stats.overdue ? `${stats.overdue} überfällig` : undefined} tone={stats.overdue ? "warn" : "neutral"} />
        <StatCard label="Wartung fällig" value={stats.serviceDue} tone={stats.serviceDue ? "warn" : "neutral"} href="/weapons?status=due" />
        <StatCard label="Meldungen offen" value={stats.minorOpen} tone={stats.minorOpen ? "warn" : "neutral"} href="/weapons/loans#minors" hint="Minderjährige" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <LendButton weapons={available.map((w) => ({ id: w.id, name: w.name }))} members={members} defaultReportDays={reportDays} label="Waffe ausleihen" />
        <LinkButton href="/weapons/loans" variant="secondary"><HandHelping className="h-4 w-4" /> Ausleihen &amp; Rückgabe</LinkButton>
        {canManage ? <LinkButton href="/api/export/weapons" variant="ghost" prefetch={false}><Download className="h-4 w-4" /> CSV</LinkButton> : null}
      </div>

      <LinkTabs items={tabs} active={status ?? "active"} label="Status wählen" className="mb-3" />
      <WeaponFilters disciplines={disciplines} />

      {weapons.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-5 w-5" />}
          title={stats.total === 0 ? "Noch keine Vereinswaffen" : "Keine Waffen gefunden"}
          text={stats.total === 0 ? (canManage ? "Erfasse die Waffen des Vereins mit Schusszähler und Wartungsintervall." : "Die Waffenverantwortlichen erfassen hier die Vereinswaffen.") : "Filter anpassen oder Suche leeren."}
          action={stats.total === 0 && canManage ? <LinkButton href="/weapons/new"><Plus className="h-4 w-4" /> Erste Waffe erfassen</LinkButton> : undefined}
        />
      ) : (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {weapons.map((w) => <WeaponRow key={w.id} w={w} />)}
        </Card>
      )}
    </div>
  );
}

function WeaponRow({ w }: { w: WeaponListItem }) {
  const st = weaponStatusInfo(w.status);
  const sub = [w.discipline, w.caliber, [w.manufacturer, w.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  return (
    <Link href={`/weapons/${w.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{w.name}</span>
          <Badge tone={st.tone}>{st.label}</Badge>
          {w.service.due && w.status !== "SERVICE" ? <Badge tone="warn"><AlertTriangle className="mr-1 h-3 w-3" /> Wartung fällig</Badge> : null}
          {w.openLoan?.overdue ? <Badge tone="danger">überfällig</Badge> : null}
          {w.openLoan?.isMinor ? <Badge tone="warn">minderjährig</Badge> : null}
        </div>
        {sub ? <div className="truncate text-xs text-ink-3">{sub}</div> : null}
        <div className="text-xs text-ink-3">
          {fmt(w.shotCount)} Schuss
          {w.serialNumber ? ` · Nr. ${w.serialNumber}` : ""}
          {w.openLoan ? ` · bei ${w.openLoan.borrower} seit ${formatDateZurich(w.openLoan.loanedAt, { weekday: undefined })}` : ""}
          {w.blockReason ? ` · ${w.blockReason}` : ""}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
    </Link>
  );
}
