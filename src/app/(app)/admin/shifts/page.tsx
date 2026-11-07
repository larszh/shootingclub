import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronRight, HandHelping, Plus } from "lucide-react";
import { Badge, Card, EmptyState, LinkButton, LinkTabs, PageHeader, SectionTitle } from "@/components/ui";
import { formatTimeRange } from "@/lib/time";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDate, type TFunction } from "@/lib/i18n/core";
import { INTL_LOCALE } from "@/lib/i18n/locales";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";
import { requireShiftsAdmin } from "@/modules/shifts/guard";
import { listAdminShifts, nowInstant, type AdminShiftScope, type ShiftView } from "@/modules/shifts/queries";
import { formatHours } from "@/modules/shifts/logic";
import { kindMeta } from "@/modules/events/types";
import { kindLabel } from "@/modules/events/ui/i18n";
import { qualificationLabel } from "@/modules/qualifications/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.shifts.admin.metaTitle") };
}

const SCOPES: AdminShiftScope[] = ["upcoming", "open", "confirm", "past"];

export default async function AdminShiftsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const ctx = await requireShiftsAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const sp = await searchParams;
  const scope: AdminShiftScope = SCOPES.some((s) => s === sp.scope) ? (sp.scope as AdminShiftScope) : "upcoming";
  const now = nowInstant();
  const shifts = await listAdminShifts(ctx.tenant.id, scope, now);

  return (
    <div>
      <PageHeader title={t("adm2.shifts.admin.title")} subtitle={t("adm2.shifts.admin.subtitle")} back={{ href: "/shifts", label: t("adm2.shifts.admin.title") }}
        action={<LinkButton href="/admin/shifts/new"><Plus className="h-4 w-4" /> {t("adm2.shifts.admin.add")}</LinkButton>} />
      <LinkTabs active={scope} label={t("adm2.shifts.admin.filter")} className="mb-4" items={SCOPES.map((s) => ({ value: s, label: t(`adm2.shifts.scope.${s}`), href: s === "upcoming" ? "/admin/shifts" : `/admin/shifts?scope=${s}` }))} />

      {shifts.length === 0 ? (
        <EmptyState icon={<HandHelping className="h-5 w-5" />}
          title={t(`adm2.shifts.empty.${scope}`)}
          text={scope === "upcoming" ? t("adm2.shifts.empty.text") : undefined}
          action={scope === "upcoming" ? <LinkButton href="/admin/shifts/new"><Plus className="h-4 w-4" /> {t("adm2.shifts.empty.first")}</LinkButton> : undefined} />
      ) : (
        <ShiftList shifts={shifts} now={now} t={t} locale={locale} />
      )}
    </div>
  );
}

function ShiftList({ shifts, now, t, locale }: { shifts: ShiftView[]; now: Date; t: TFunction; locale: Locale }) {
  const groups: Array<{ key: string; label: string; items: ShiftView[] }> = [];
  for (const s of shifts) {
    const key = s.day.slice(0, 7);
    const g = groups[groups.length - 1];
    if (g && g.key === key) g.items.push(s);
    else groups.push({ key, label: new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "Europe/Zurich", month: "long", year: "numeric" }).format(s.startsAt), items: [s] });
  }
  return (
    <div>
      {groups.map((g) => (
        <section key={g.key}>
          <SectionTitle>{g.label}</SectionTitle>
          <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
            {g.items.map((s) => {
              const open = s.assignments.filter((a) => a.status === "ASSIGNED").length;
              const started = s.startsAt <= now;
              const meta = s.event ? kindMeta(s.event.kind) : null;
              return (
                <Link key={s.id} href={`/admin/shifts/${s.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <div className="w-12 shrink-0 text-center">
                    <div className="text-xs uppercase text-ink-3">{formatDate(s.startsAt, locale, { weekday: "short", day: undefined, month: undefined, year: undefined })}</div>
                    <div className="text-lg font-semibold tabular-nums leading-tight">{formatDate(s.startsAt, locale, { day: "numeric", month: undefined, year: undefined })}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{s.title}</span>
                      {s.event?.isCancelled ? <Badge tone="danger">{t("adm2.shifts.list.cancelled")}</Badge> : null}
                      {!started && s.staffing.understaffed ? <Badge tone="warn">{t("adm2.shifts.list.missing", { n: s.staffing.open })}</Badge> : null}
                      {s.qualificationMissing ? <Badge tone="warn"><AlertTriangle className="mr-1 h-3 w-3" /> {qualificationLabel(s.requiredQualification, t)}</Badge> : null}
                      {started && open ? <Badge tone="accent">{t("adm2.shifts.list.toConfirm", { n: open })}</Badge> : null}
                    </div>
                    <div className="truncate text-xs text-ink-3">
                      {t("adm2.shifts.list.row", { time: formatTimeRange(s.startsAt, s.endsAt), h: formatHours(s.defaultHours), filled: s.staffing.filled, capacity: s.staffing.capacity })}
                      {s.event ? <> · <span className={cn("rounded-full px-1.5", meta?.chip)}>{kindLabel(s.event.kind, locale)}</span> {s.event.title}</> : t("adm2.shifts.list.rangeDuty")}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
                </Link>
              );
            })}
          </Card>
        </section>
      ))}
    </div>
  );
}
