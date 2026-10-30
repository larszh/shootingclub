import type { Metadata } from "next";
import { CalendarCheck2, Clock, HandHelping, Settings, ShieldCheck } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, LinkTabs, PageHeader, ProgressBar, SectionTitle, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDateZurich, todayZurich } from "@/lib/time";
import { requireShifts } from "@/modules/shifts/guard";
import { currentSwissYear, listMyShifts, listMyWorkLogs, listUpcomingShifts, myHoursSummary, nowInstant, type ShiftView } from "@/modules/shifts/queries";
import { formatHours } from "@/modules/shifts/logic";
import { ASSIGNMENT_LABELS } from "@/modules/shifts/types";
import { ShiftCard } from "@/modules/shifts/ui/shift-card";
import { DeleteWorkLogButton } from "@/modules/shifts/ui/member-buttons";
import { WorkLogForm } from "@/modules/shifts/ui/worklog-form";
import { myQualifications } from "@/modules/qualifications/queries";
import { qualificationLabel } from "@/modules/qualifications/types";

export const metadata: Metadata = { title: "Helfereinsätze" };

type Tab = "open" | "mine" | "hours";

const dayFmt = (d: Date) => new Intl.DateTimeFormat("de-CH", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

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

  const [upcoming, mine, summary] = await Promise.all([
    listUpcomingShifts(tenantId, now),
    listMyShifts(tenantId, userId, year, now),
    myHoursSummary(tenantId, userId, year),
  ]);
  const openCount = upcoming.filter((s) => !s.staffing.full && !s.assignments.some((a) => a.userId === userId)).length;

  const tabs = [
    { value: "open", href: "/shifts", label: "Offen", count: openCount },
    { value: "mine", href: "/shifts?tab=mine", label: "Meine", count: mine.upcoming.length },
    { value: "hours", href: "/shifts?tab=hours", label: "Stunden" },
  ];

  return (
    <div>
      <PageHeader
        title="Helfereinsätze"
        subtitle="Mithelfen am Stand und an Anlässen"
        action={canManage ? <LinkButton href="/admin/shifts" variant="secondary" size="md"><Settings className="h-4 w-4" /> Planen</LinkButton> : undefined}
      />
      {sp.denied ? <Alert className="mb-4">Dafür fehlt dir die Berechtigung.</Alert> : null}

      {summary.settings.enabled && summary.balance.subject ? (
        <Card className="animate-rise mb-4 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-ink-3">Meine Stunden {year}</span>
            <span className="font-semibold tabular-nums">{formatHours(summary.hours.total)} / {formatHours(summary.balance.required)} h</span>
          </div>
          <ProgressBar className="mt-2" value={summary.hours.total} max={Math.max(summary.balance.required, 0.01)} label={`Stunden ${year}`} tone={summary.balance.missing ? "accent" : "ok"} />
          <p className="mt-1.5 text-xs text-ink-3">
            {summary.balance.missing ? `Es fehlen noch ${formatHours(summary.balance.missing)} h.` : "Soll erfüllt. Danke!"}
            {summary.hours.pendingLogHours ? ` ${formatHours(summary.hours.pendingLogHours)} h warten auf Bewilligung.` : ""}
          </p>
        </Card>
      ) : null}

      <LinkTabs items={tabs} active={tab} label="Ansicht wählen" className="mb-4" />

      {tab === "open" ? <OpenTab list={upcoming} userId={userId} now={now} /> : null}
      {tab === "mine" ? <MineTab tenantId={tenantId} userId={userId} mine={mine} now={now} /> : null}
      {tab === "hours" ? <HoursTab tenantId={tenantId} userId={userId} year={year} summary={summary} /> : null}
    </div>
  );
}

function OpenTab({ list, userId, now }: { list: ShiftView[]; userId: string; now: Date }) {
  if (!list.length) {
    return <EmptyState icon={<HandHelping className="h-5 w-5" />} title="Keine Einsätze geplant" text="Sobald der Verein Helfer sucht, erscheinen die Einsätze hier." />;
  }
  return (
    <div className="space-y-5">
      {groupByDay(list).map((g) => (
        <section key={g.day}>
          <SectionTitle>{formatDateZurich(g.date, { weekday: "long", day: "numeric", month: "long", year: undefined })}</SectionTitle>
          <div className="space-y-2.5">
            {g.items.map((s) => <ShiftCard key={s.id} s={s} userId={userId} now={now} showDate={false} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

async function MineTab({ tenantId, userId, mine, now }: { tenantId: string; userId: string; mine: { upcoming: ShiftView[]; past: ShiftView[] }; now: Date }) {
  const quals = await myQualifications(tenantId, userId);
  return (
    <div>
      <SectionTitle>Kommende Einsätze</SectionTitle>
      {mine.upcoming.length ? (
        <div className="space-y-2.5">{mine.upcoming.map((s) => <ShiftCard key={s.id} s={s} userId={userId} now={now} />)}</div>
      ) : (
        <EmptyState icon={<CalendarCheck2 className="h-5 w-5" />} title="Du bist nirgends eingeteilt" text="Unter «Offen» findest du Einsätze, bei denen noch Hilfe gebraucht wird." action={<LinkButton href="/shifts" variant="secondary">Offene Einsätze</LinkButton>} />
      )}

      {mine.past.length ? (
        <>
          <SectionTitle>Geleistet dieses Jahr</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {mine.past.map((s) => {
              const a = s.assignments.find((x) => x.userId === userId)!;
              const st = ASSIGNMENT_LABELS[a.status] ?? ASSIGNMENT_LABELS.ASSIGNED!;
              return (
                <div key={s.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.title}</div>
                    <div className="text-xs text-ink-3">{formatDateZurich(s.startsAt)}{s.event ? ` · ${s.event.title}` : ""}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone={a.status === "ASSIGNED" ? "neutral" : st.tone}>{a.status === "ASSIGNED" ? "noch nicht bestätigt" : st.label}</Badge>
                    {a.status === "DONE" ? <div className="mt-0.5 text-xs tabular-nums text-ink-3">{formatHours(a.hours ?? s.defaultHours)} h</div> : null}
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionTitle>Meine Qualifikationen</SectionTitle>
      {quals.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {quals.map((q) => (
            <div key={q.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
              <ShieldCheck className={q.state === "expired" ? "h-5 w-5 shrink-0 text-danger" : q.state === "expiring" ? "h-5 w-5 shrink-0 text-warn" : "h-5 w-5 shrink-0 text-ok"} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{qualificationLabel(q.kind)}{q.label ? ` · ${q.label}` : ""}</div>
                <div className="text-xs text-ink-3">
                  {q.number ? `Nr. ${q.number} · ` : ""}
                  {q.validUntil ? `gültig bis ${dayFmt(q.validUntil)}` : "ohne Ablaufdatum"}
                </div>
              </div>
              {q.state === "expired" ? <Badge tone="danger">abgelaufen</Badge> : q.state === "expiring" ? <Badge tone="warn">läuft ab</Badge> : q.state === "future" ? <Badge tone="outline">ab {q.validFrom ? dayFmt(q.validFrom) : ""}</Badge> : null}
            </div>
          ))}
        </Card>
      ) : (
        <p className="text-sm text-ink-3">Keine Qualifikationen erfasst. Ausweise (z.B. Schützenmeister, Erste Hilfe) bitte beim Vorstand abgeben, damit sie hier erscheinen.</p>
      )}
    </div>
  );
}

async function HoursTab({ tenantId, userId, year, summary }: { tenantId: string; userId: string; year: number; summary: Awaited<ReturnType<typeof myHoursSummary>> }) {
  const logs = await listMyWorkLogs(tenantId, userId, year);
  const { settings, hours, balance } = summary;
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Einsätze" value={`${formatHours(hours.shiftHours)} h`} icon={<HandHelping className="h-4 w-4" />} />
        <StatCard label="Rapporte bewilligt" value={`${formatHours(hours.logHours)} h`} icon={<Clock className="h-4 w-4" />} hint={hours.pendingLogHours ? `${formatHours(hours.pendingLogHours)} h offen` : undefined} />
        {settings.enabled && balance.subject ? (
          <>
            <StatCard label={`Soll ${year}`} value={`${formatHours(balance.required)} h`} />
            <StatCard label="Fehlen noch" value={`${formatHours(balance.missing)} h`} tone={balance.missing ? "warn" : "ok"} hint={balance.amountCents ? `Ersatzabgabe ${formatMoney(balance.amountCents)}` : undefined} />
          </>
        ) : null}
      </div>
      {settings.enabled && summary.exempt ? <Alert tone="info" className="mb-4">Du bist von der Arbeitsstundenpflicht befreit. Erfasste Stunden werden trotzdem gezählt.</Alert> : null}
      {settings.enabled && balance.missing > 0 && balance.amountCents > 0 ? (
        <p className="mb-4 text-xs text-ink-3">Fehlende Stunden werden gemäss Beschluss des Vereins nach Jahresende als Ersatzabgabe verrechnet ({formatMoney(settings.ratePerMissingHourCents)} pro Stunde, Stand heute).</p>
      ) : null}

      <WorkLogForm today={todayZurich()} />

      <SectionTitle>Meine Arbeitsrapporte {year}</SectionTitle>
      {logs.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {logs.map((l) => (
            <div key={l.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{l.description}</div>
                <div className="text-xs text-ink-3">{dayFmt(l.date)} · {formatHours(l.hours)} h</div>
              </div>
              {l.approvedAt ? <Badge tone="ok">bewilligt</Badge> : (
                <>
                  <Badge tone="warn">offen</Badge>
                  <DeleteWorkLogButton id={l.id} />
                </>
              )}
            </div>
          ))}
        </Card>
      ) : (
        <p className="text-sm text-ink-3">Noch keine Rapporte. Arbeit ausserhalb geplanter Einsätze (z.B. Unterhalt) kannst du oben erfassen.</p>
      )}
    </div>
  );
}
