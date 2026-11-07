import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Download, HandHelping, Plus, Settings, Wrench } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, LinkTabs, PageHeader, StatCard } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { INTL_LOCALE } from "@/lib/i18n/locales";
import { formatDate, type TFunction } from "@/lib/i18n/core";
import { requireWeapons } from "@/modules/weapons/guard";
import { defaultMinorReportDays, listDisciplines, listWeapons, memberOptions, weaponStats, type WeaponFilter, type WeaponListItem } from "@/modules/weapons/queries";
import { listAvailableWeapons } from "@/modules/weapons/service";
import { isWeaponStatus, weaponStatusInfo } from "@/modules/weapons/types";
import { WeaponFilters } from "@/modules/weapons/ui/filters";
import { LendButton } from "@/modules/weapons/ui/lend-dialog";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.weapons.title") };
}

export default async function WeaponsPage({ searchParams }: { searchParams: Promise<{ status?: string; discipline?: string; q?: string; denied?: string }> }) {
  const ctx = await requireWeapons();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const fmt = (n: number) => new Intl.NumberFormat(INTL_LOCALE[locale]).format(n);
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
    { value: "active", label: t("adm2.weapons.list.allActive"), href: qs("active") },
    { value: "AVAILABLE", label: t("adm2.weapons.status.AVAILABLE"), href: qs("AVAILABLE"), count: stats.available },
    { value: "LOANED", label: t("adm2.weapons.status.LOANED"), href: qs("LOANED"), count: stats.loaned },
    { value: "due", label: t("adm2.weapons.list.serviceDue"), href: qs("due"), count: stats.serviceDue },
    { value: "SERVICE", label: t("adm2.weapons.status.SERVICE"), href: qs("SERVICE") },
    { value: "BLOCKED", label: t("adm2.weapons.status.BLOCKED"), href: qs("BLOCKED") },
    { value: "RETIRED", label: t("adm2.weapons.status.RETIRED"), href: qs("RETIRED") },
  ];

  return (
    <div>
      <PageHeader
        title={t("adm2.weapons.title")}
        subtitle={t(stats.total === 1 ? "adm2.weapons.list.count.one" : "adm2.weapons.list.count.other", { n: stats.total })}
        action={canManage ? <LinkButton href="/weapons/new" size="md"><Plus className="h-4 w-4" /> {t("adm2.weapons.list.add")}</LinkButton> : undefined}
      />
      {sp.denied ? <Alert className="mb-4">{t("adm2.weapons.list.denied")}</Alert> : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("adm2.weapons.status.AVAILABLE")} value={stats.available} tone="ok" href="/weapons?status=AVAILABLE" />
        <StatCard label={t("adm2.weapons.status.LOANED")} value={stats.loaned} href="/weapons/loans" hint={stats.overdue ? t("adm2.weapons.list.overdueN", { n: stats.overdue }) : undefined} tone={stats.overdue ? "warn" : "neutral"} />
        <StatCard label={t("adm2.weapons.list.serviceDue")} value={stats.serviceDue} tone={stats.serviceDue ? "warn" : "neutral"} href="/weapons?status=due" />
        <StatCard label={t("adm2.weapons.list.reportsOpen")} value={stats.minorOpen} tone={stats.minorOpen ? "warn" : "neutral"} href="/weapons/loans#minors" hint={t("adm2.weapons.list.minors")} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <LendButton weapons={available.map((w) => ({ id: w.id, name: w.name }))} members={members} defaultReportDays={reportDays} label={t("adm2.weapons.list.lendWeapon")} />
        <LinkButton href="/weapons/loans" variant="secondary"><HandHelping className="h-4 w-4" /> {t("adm2.weapons.list.loansReturns")}</LinkButton>
        {canManage ? <LinkButton href="/api/export/weapons" variant="ghost" prefetch={false}><Download className="h-4 w-4" /> CSV</LinkButton> : null}
        {canManage ? <LinkButton href="/admin/weapons/settings" variant="ghost"><Settings className="h-4 w-4" /> {t("adm2.common.settings")}</LinkButton> : null}
      </div>

      <LinkTabs items={tabs} active={status ?? "active"} label={t("adm2.weapons.list.statusTabs")} className="mb-3" />
      <WeaponFilters disciplines={disciplines} />

      {weapons.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-5 w-5" />}
          title={stats.total === 0 ? t("adm2.weapons.list.emptyNone") : t("adm2.weapons.list.emptyFilter")}
          text={stats.total === 0 ? (canManage ? t("adm2.weapons.list.emptyManage") : t("adm2.weapons.list.emptyMember")) : t("adm2.weapons.list.emptyFilterText")}
          action={stats.total === 0 && canManage ? <LinkButton href="/weapons/new"><Plus className="h-4 w-4" /> {t("adm2.weapons.list.addFirst")}</LinkButton> : undefined}
        />
      ) : (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {weapons.map((w) => <WeaponRow key={w.id} w={w} t={t} fmt={fmt} day={(d) => formatDate(d, locale)} />)}
        </Card>
      )}
    </div>
  );
}

function WeaponRow({ w, t, fmt, day }: { w: WeaponListItem; t: TFunction; fmt: (n: number) => string; day: (d: Date) => string }) {
  const st = weaponStatusInfo(w.status, t);
  const sub = [w.discipline, w.caliber, [w.manufacturer, w.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  return (
    <Link href={`/weapons/${w.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{w.name}</span>
          <Badge tone={st.tone}>{st.label}</Badge>
          {w.service.due && w.status !== "SERVICE" ? <Badge tone="warn"><AlertTriangle className="mr-1 h-3 w-3" /> {t("adm2.weapons.list.serviceDue")}</Badge> : null}
          {w.openLoan?.overdue ? <Badge tone="danger">{t("adm2.weapons.overdue")}</Badge> : null}
          {w.openLoan?.isMinor ? <Badge tone="warn">{t("adm2.weapons.lend.minor")}</Badge> : null}
        </div>
        {sub ? <div className="truncate text-xs text-ink-3">{sub}</div> : null}
        <div className="text-xs text-ink-3">
          {t("adm2.weapons.shots", { n: fmt(w.shotCount) })}
          {w.serialNumber ? t("adm2.weapons.serialShort", { n: w.serialNumber }) : ""}
          {w.openLoan ? t("adm2.weapons.withSince", { name: w.openLoan.borrower, date: day(w.openLoan.loanedAt) }) : ""}
          {w.blockReason ? ` · ${w.blockReason}` : ""}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
    </Link>
  );
}
