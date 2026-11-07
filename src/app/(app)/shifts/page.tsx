import type { Metadata } from "next";
import { CalendarCheck2, Clock, HandHelping, Settings, ShieldCheck } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, LinkTabs, PageHeader, ProgressBar, SectionTitle, StatCard } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { formatDate, formatMoneyLocale, getRequestLocale, getT, type Locale, type TFunction } from "@/lib/i18n";
import { requireShifts } from "@/modules/shifts/guard";
import { currentSwissYear, listMyShifts, listMyWorkLogs, listUpcomingShifts, myHoursSummary, nowInstant, type ShiftView } from "@/modules/shifts/queries";
import { formatHours } from "@/modules/shifts/logic";
import { ASSIGNMENT_LABELS } from "@/modules/shifts/types";
import { ShiftCard } from "@/modules/shifts/ui/shift-card";
import { DeleteWorkLogButton } from "@/modules/shifts/ui/member-buttons";
import { WorkLogForm } from "@/modules/shifts/ui/worklog-form";
import { myQualifications } from "@/modules/qualifications/queries";
import { qualificationText, tOr } from "@/modules/scores/ui/labels";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.shifts.title") };
}

type Tab = "open" | "mine" | "hours";

/** Betrag: Deutsch wie bisher, sonst im Format der Sprache. */
const money = (cents: number, locale: Locale) => (locale === "de" ? formatMoney(cents) : formatMoneyLocale(cents, locale));

/** @db.Date-Wert (UTC-Mitternacht des Kalendertags) im Format der Sprache. */
const dayFmt = (d: Date, locale: Locale) => formatDate(d, locale, { timeZone: "UTC" });

function groupByDay(list: ShiftView[]) {
  const groups: Array<{ day: string; date: Date; items: ShiftView[] }> = [];
  for (const s of list) {
    const g = groups[groups.length - 1];
    if (g && g.day === s.day) g.items.push(s);
    else groups.push({ day: s.day, date: s.startsAt, items: [s] });
  }
  return groups;
}

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ tab?: string; denied?: string }> }) {
  const ctx = await requireShifts();
  const sp = await searchParams;
  const tab: Tab = sp.tab === "mine" || sp.tab === "hours" ? sp.tab : "open";
  const tenantId = ctx.tenant.id;
  const userId = ctx.user.id;
  const now = nowInstant();
  const year = currentSwissYear(now);
  const canManage = ctx.can("shifts.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);

  const [upcoming, mine, summary] = await Promise.all([
    listUpcomingShifts(tenantId, now),
    listMyShifts(tenantId, userId, year, now),
    myHoursSummary(tenantId, userId, year),
  ]);
  const openCount = upcoming.filter((s) => !s.staffing.full && !s.assignments.some((a) => a.userId === userId)).length;

  const tabs = [
    { value: "open", href: "/shifts", label: t("shooting.shifts.tab.open"), count: openCount },
    { value: "mine", href: "/shifts?tab=mine", label: t("shooting.shifts.tab.mine"), count: mine.upcoming.length },
    { value: "hours", href: "/shifts?tab=hours", label: t("shooting.shifts.tab.hours") },
  ];

  return (
    <div>
      <PageHeader
        title={t("shooting.shifts.title")}
        subtitle={t("shooting.shifts.subtitle")}
        action={canManage ? <LinkButton href="/admin/shifts" variant="secondary" size="md"><Settings className="h-4 w-4" /> {t("shooting.shifts.plan")}</LinkButton> : undefined}
      />
      {sp.denied ? <Alert className="mb-4">{t("shooting.shifts.denied")}</Alert> : null}

      {summary.settings.enabled && summary.balance.subject ? (
        <Card className="animate-rise mb-4 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-ink-3">{t("shooting.shifts.myHours", { year })}</span>
            <span className="font-semibold tabular-nums">{formatHours(summary.hours.total)} / {formatHours(summary.balance.required)} h</span>
          </div>
          <ProgressBar className="mt-2" value={summary.hours.total} max={Math.max(summary.balance.required, 0.01)} label={t("shooting.shifts.hoursYear", { year })} tone={summary.balance.missing ? "accent" : "ok"} />
          <p className="mt-1.5 text-xs text-ink-3">
            {summary.balance.missing ? t("shooting.shifts.missing", { h: formatHours(summary.balance.missing) }) : t("shooting.shifts.fulfilled")}
            {summary.hours.pendingLogHours ? t("shooting.shifts.pendingApproval", { h: formatHours(summary.hours.pendingLogHours) }) : ""}
          </p>
        </Card>
      ) : null}

      <LinkTabs items={tabs} active={tab} label={t("shooting.shifts.tabsAria")} className="mb-4" />

      {tab === "open" ? <OpenTab list={upcoming} userId={userId} now={now} locale={locale} t={t} /> : null}
      {tab === "mine" ? <MineTab tenantId={tenantId} userId={userId} mine={mine} now={now} locale={locale} t={t} /> : null}
      {tab === "hours" ? <HoursTab tenantId={tenantId} userId={userId} year={year} summary={summary} locale={locale} t={t} /> : null}
    </div>
  );
}

function OpenTab({ list, userId, now, locale, t }: { list: ShiftView[]; userId: string; now: Date; locale: Locale; t: TFunction }) {
  if (!list.length) {
    return <EmptyState icon={<HandHelping className="h-5 w-5" />} title={t("shooting.shifts.noneTitle")} text={t("shooting.shifts.noneText")} />;
  }
  return (
    <div className="space-y-5">
      {groupByDay(list).map((g) => (
        <section key={g.day}>
          <SectionTitle>{formatDate(g.date, locale, { weekday: "long", day: "numeric", month: "long", year: undefined })}</SectionTitle>
          <div className="space-y-2.5">
            {g.items.map((s) => <ShiftCard key={s.id} s={s} userId={userId} now={now} showDate={false} locale={locale} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

async function MineTab({ tenantId, userId, mine, now, locale, t }: { tenantId: string; userId: string; mine: { upcoming: ShiftView[]; past: ShiftView[] }; now: Date; locale: Locale; t: TFunction }) {
  const quals = await myQualifications(tenantId, userId);
  return (
    <div>
      <SectionTitle>{t("shooting.shifts.upcoming")}</SectionTitle>
      {mine.upcoming.length ? (
        <div className="space-y-2.5">{mine.upcoming.map((s) => <ShiftCard key={s.id} s={s} userId={userId} now={now} locale={locale} />)}</div>
      ) : (
        <EmptyState icon={<CalendarCheck2 className="h-5 w-5" />} title={t("shooting.shifts.notAssigned")} text={t("shooting.shifts.notAssignedText")} action={<LinkButton href="/shifts" variant="secondary">{t("shooting.shifts.openShifts")}</LinkButton>} />
      )}

      {mine.past.length ? (
        <>
          <SectionTitle>{t("shooting.shifts.doneThisYear")}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {mine.past.map((s) => {
              const a = s.assignments.find((x) => x.userId === userId)!;
              const st = ASSIGNMENT_LABELS[a.status] ?? ASSIGNMENT_LABELS.ASSIGNED!;
              return (
                <div key={s.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.title}</div>
                    <div className="text-xs text-ink-3">{formatDate(s.startsAt, locale, { weekday: "short" })}{s.event ? ` · ${s.event.title}` : ""}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone={a.status === "ASSIGNED" ? "neutral" : st.tone}>{a.status === "ASSIGNED" ? t("shooting.shifts.notConfirmed") : tOr(t, `shooting.shifts.status.${a.status}`, st.label)}</Badge>
                    {a.status === "DONE" ? <div className="mt-0.5 text-xs tabular-nums text-ink-3">{t("shooting.shifts.hoursN", { h: formatHours(a.hours ?? s.defaultHours) })}</div> : null}
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionTitle>{t("shooting.shifts.myQualifications")}</SectionTitle>
      {quals.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {quals.map((q) => (
            <div key={q.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
              <ShieldCheck className={q.state === "expired" ? "h-5 w-5 shrink-0 text-danger" : q.state === "expiring" ? "h-5 w-5 shrink-0 text-warn" : "h-5 w-5 shrink-0 text-ok"} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{qualificationText(t, q.kind)}{q.label ? ` · ${q.label}` : ""}</div>
                <div className="text-xs text-ink-3">
                  {q.number ? t("shooting.shifts.qualNumber", { n: q.number }) : ""}
                  {q.validUntil ? t("shooting.shifts.validUntil", { date: dayFmt(q.validUntil, locale) }) : t("shooting.shifts.noExpiry")}
                </div>
              </div>
              {q.state === "expired" ? <Badge tone="danger">{t("shooting.shifts.expired")}</Badge> : q.state === "expiring" ? <Badge tone="warn">{t("shooting.shifts.expiring")}</Badge> : q.state === "future" ? <Badge tone="outline">{t("shooting.shifts.validFrom", { date: q.validFrom ? dayFmt(q.validFrom, locale) : "" })}</Badge> : null}
            </div>
          ))}
        </Card>
      ) : (
        <p className="text-sm text-ink-3">{t("shooting.shifts.noQualifications")}</p>
      )}
    </div>
  );
}

async function HoursTab({ tenantId, userId, year, summary, locale, t }: { tenantId: string; userId: string; year: number; summary: Awaited<ReturnType<typeof myHoursSummary>>; locale: Locale; t: TFunction }) {
  const logs = await listMyWorkLogs(tenantId, userId, year);
  const { settings, hours, balance } = summary;
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("shooting.shifts.stat.shifts")} value={t("shooting.shifts.hoursN", { h: formatHours(hours.shiftHours) })} icon={<HandHelping className="h-4 w-4" />} />
        <StatCard label={t("shooting.shifts.stat.logs")} value={t("shooting.shifts.hoursN", { h: formatHours(hours.logHours) })} icon={<Clock className="h-4 w-4" />} hint={hours.pendingLogHours ? t("shooting.shifts.stat.logsOpen", { h: formatHours(hours.pendingLogHours) }) : undefined} />
        {settings.enabled && balance.subject ? (
          <>
            <StatCard label={t("shooting.shifts.stat.required", { year })} value={t("shooting.shifts.hoursN", { h: formatHours(balance.required) })} />
            <StatCard label={t("shooting.shifts.stat.missing")} value={t("shooting.shifts.hoursN", { h: formatHours(balance.missing) })} tone={balance.missing ? "warn" : "ok"} hint={balance.amountCents ? t("shooting.shifts.stat.compensation", { amount: money(balance.amountCents, locale) }) : undefined} />
          </>
        ) : null}
      </div>
      {settings.enabled && summary.exempt ? <Alert tone="info" className="mb-4">{t("shooting.shifts.exempt")}</Alert> : null}
      {settings.enabled && balance.missing > 0 && balance.amountCents > 0 ? (
        <p className="mb-4 text-xs text-ink-3">{t("shooting.shifts.compensationNote", { rate: money(settings.ratePerMissingHourCents, locale) })}</p>
      ) : null}

      <WorkLogForm today={todayZurich()} />

      <SectionTitle>{t("shooting.shifts.myLogs", { year })}</SectionTitle>
      {logs.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {logs.map((l) => (
            <div key={l.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{l.description}</div>
                <div className="text-xs text-ink-3">{dayFmt(l.date, locale)} · {t("shooting.shifts.hoursN", { h: formatHours(l.hours) })}</div>
              </div>
              {l.approvedAt ? <Badge tone="ok">{t("shooting.shifts.approved")}</Badge> : (
                <>
                  <Badge tone="warn">{t("shooting.shifts.pending")}</Badge>
                  <DeleteWorkLogButton id={l.id} />
                </>
              )}
            </div>
          ))}
        </Card>
      ) : (
        <p className="text-sm text-ink-3">{t("shooting.shifts.noLogs")}</p>
      )}
    </div>
  );
}
