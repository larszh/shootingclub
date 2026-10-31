import type { Metadata } from "next";
import Link from "next/link";
import { DoorClosed, DoorOpen, QrCode, Settings } from "lucide-react";
import { db } from "@/lib/db";
import { todayZurich } from "@/lib/time";
import { Alert, Badge, Card, LinkButton, LinkTabs, PageHeader, SectionTitle } from "@/components/ui";
import { requireRange } from "@/modules/range/guard";
import { getActiveRules, getDayBoard, getMyOpenVisit, listMemberOptions, listOpenDays, listRangeResources, suggestFlags } from "@/modules/range/queries";
import { toBoardVisits } from "@/modules/range/board";
import { dbDateKey } from "@/modules/range/logic";
import { dayTitle, fmtDay, fmtTime } from "@/modules/range/format";
import { RESPONSIBILITY_HINT } from "@/modules/range/types";
import { rangeTabs } from "@/modules/range/nav";
import { RangeTabs } from "@/modules/range/ui/range-tabs";
import { EmergencyBox } from "@/modules/range/ui/emergency-box";
import { DayBoard, type BoardWeapon } from "@/modules/range/ui/day-board";
import { OpenDayForm } from "@/modules/range/ui/open-day-form";
import { hasValidQualification } from "@/modules/qualifications/service";
import { listAvailableWeapons } from "@/modules/weapons/service";

export const metadata: Metadata = { title: "Heute am Stand" };

const DUTY_QUALIFICATIONS = ["SCHUETZENMEISTER", "RANGE_OFFICER"];

export default async function RangeTodayPage({ searchParams }: { searchParams: Promise<{ day?: string; new?: string; denied?: string }> }) {
  const ctx = await requireRange();
  const sp = await searchParams;
  const tenantId = ctx.tenant.id;
  const isDuty = ctx.can("range.duty");
  const isManager = ctx.can("range.manage");
  const today = todayZurich();
  const [openDays, rules] = await Promise.all([listOpenDays(tenantId), getActiveRules(tenantId)]);
  const todayDays = openDays.filter((d) => dbDateKey(d.date) === today);
  const tabs = rangeTabs({ duty: isDuty, manage: isManager });
  const header = (
    <PageHeader
      title="Heute am Stand"
      subtitle={ctx.tenant.name}
      action={isManager ? <LinkButton href="/admin/range" variant="secondary" size="sm" className="h-11" aria-label="Standbetrieb einrichten"><Settings className="h-4 w-4" /></LinkButton> : undefined}
    />
  );

  // --- Mitglieder: nur Status -------------------------------------------------------
  if (!isDuty) {
    const mine = await getMyOpenVisit(tenantId, ctx.user.id);
    return (
      <div className="space-y-4">
        {header}
        <RangeTabs tabs={tabs} />
        {sp.denied ? <Alert tone="warn">Dafür fehlt dir die Berechtigung.</Alert> : null}
        <StatusCard days={todayDays} />
        {mine ? (
          <Card className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0"><div className="font-medium">Du bist eingecheckt</div><div className="text-sm text-ink-3">seit {fmtTime(mine.checkedInAt)}</div></div>
            <LinkButton href="/range/checkin" variant="secondary" className="shrink-0">Auschecken</LinkButton>
          </Card>
        ) : todayDays.length ? (
          <LinkButton href="/range/checkin" size="lg" className="h-14 w-full">Einchecken</LinkButton>
        ) : null}
        <EmergencyBox hasRules={!!rules} />
      </div>
    );
  }

  // --- Standdienst -------------------------------------------------------------------
  // Standardmässig nur ein Standbuch von heute öffnen; alte (nicht abgeschlossene) nur auf Auswahl.
  const selected = sp.new ? undefined : (openDays.find((d) => d.id === sp.day) ?? todayDays[0]);
  const staleDays = openDays.filter((d) => dbDateKey(d.date) !== today);
  const dayTabLabel = (d: (typeof openDays)[number]) => `${dayTitle(d)}${dbDateKey(d.date) !== today ? ` (${fmtDay(d.date, { weekday: undefined, year: undefined })})` : ""}`;
  const [resources, members] = await Promise.all([listRangeResources(tenantId), listMemberOptions(tenantId)]);

  if (!selected) {
    const qualified = await hasValidQualification(tenantId, ctx.user.id, DUTY_QUALIFICATIONS).catch(() => false);
    const lastClosed = await db.rangeDay.findFirst({ where: { tenantId, closedAt: { not: null } }, orderBy: { date: "desc" }, include: { resource: { select: { name: true } } } });
    return (
      <div className="space-y-4">
        {header}
        <RangeTabs tabs={tabs} />
        {openDays.length ? (
          <LinkTabs active="new" label="Offene Standbücher" items={[...openDays.map((d) => ({ value: d.id, href: `/range?day=${d.id}`, label: dayTabLabel(d) })), { value: "new", href: "/range?new=1", label: "+ Neu" }]} />
        ) : null}
        {staleDays.length ? (
          <Alert tone="warn">
            {staleDays.length === 1 ? "Ein Standbuch eines früheren Tages ist noch offen" : `${staleDays.length} Standbücher früherer Tage sind noch offen`}. Bitte abschliessen:{" "}
            {staleDays.map((d, i) => (
              <span key={d.id}>{i ? ", " : ""}<Link href={`/range?day=${d.id}`} className="inline-flex min-h-11 items-center font-medium underline">{fmtDay(d.date)} · {dayTitle(d)}</Link></span>
            ))}
          </Alert>
        ) : null}
        <StatusCard days={todayDays} />
        <OpenDayForm resources={resources} members={members.map((m) => ({ userId: m.userId, name: m.name }))} currentUserId={ctx.user.id} currentQualified={qualified} />
        {lastClosed ? (
          <Link href={`/range/log/${lastClosed.id}`} className="block text-sm text-ink-3 hover:text-ink">Zuletzt: {fmtDay(lastClosed.date)} · {dayTitle(lastClosed)} →</Link>
        ) : null}
        <SectionTitle>Mitglieder-Check-in</SectionTitle>
        <Card className="flex items-center gap-3 p-4">
          <QrCode className="h-8 w-8 shrink-0 text-ink-3" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-ink-2">QR-Code im Schützenhaus aufhängen: Mitglieder scannen ihn und checken sich selbst ein.</p>
          <LinkButton href="/range/qr" variant="secondary" size="sm" className="h-11 shrink-0" target="_blank">Drucken</LinkButton>
        </Card>
        <EmergencyBox hasRules={!!rules} />
      </div>
    );
  }

  const board = await getDayBoard(tenantId, selected.id);
  if (!board) return null;
  const memberIds = board.day.visits.map((v) => v.userId).filter((x): x is string => !!x);
  const accepted = rules && memberIds.length ? await db.rulesAcceptance.findMany({ where: { rulesId: rules.id, userId: { in: memberIds } }, select: { userId: true } }) : [];
  const visits = toBoardVisits(board, rules?.id ?? null, new Set(accepted.map((a) => a.userId)));

  let weapons: BoardWeapon[] | null = null;
  if (ctx.hasModule("weapons") && ctx.can("weapons.loan")) weapons = await listAvailableWeapons(tenantId);

  let dutyWarning: string | null = null;
  if (board.day.dutyUserId) {
    const ok = await hasValidQualification(tenantId, board.day.dutyUserId, DUTY_QUALIFICATIONS).catch(() => false);
    if (!ok) dutyWarning = "Für den Standdienst ist keine gültige Qualifikation als Schützenmeister oder Standchef erfasst. Bitte prüfen, ob die Aufsicht gemäss Vorgaben sichergestellt ist.";
  }

  return (
    <div className="space-y-4">
      {header}
      <RangeTabs tabs={tabs} />
      {openDays.length > 1 || resources.length ? (
        <LinkTabs active={selected.id} label="Offene Standbücher" items={[...openDays.map((d) => ({ value: d.id, href: `/range?day=${d.id}`, label: dayTabLabel(d), count: d._count.visits })), { value: "new", href: "/range?new=1", label: "+ Neu" }]} />
      ) : null}
      <DayBoard
        key={selected.id}
        day={{ id: board.day.id, title: dayTitle(board.day), dateLabel: fmtDay(board.day.date, { weekday: "long", month: "long" }), isToday: dbDateKey(board.day.date) === today, dutyUserId: board.day.dutyUserId, dutyName: board.day.dutyName, notes: board.day.notes }}
        visits={visits}
        members={members.map((m) => ({ userId: m.userId, name: m.name, memberNumber: m.memberNumber, avatarUrl: m.avatarUrl }))}
        weapons={weapons}
        suggested={suggestFlags(board.day)}
        dutyWarning={dutyWarning}
        rulesActive={!!rules}
        year={Number(today.slice(0, 4))}
      />
      <EmergencyBox hasRules={!!rules} />
      <p className="text-xs text-ink-3">{RESPONSIBILITY_HINT}</p>
    </div>
  );
}

function StatusCard({ days }: { days: Array<{ id: string; dutyName: string | null; openedAt: Date; resource: { name: string } | null; _count: { visits: number } }> }) {
  if (!days.length) {
    return (
      <Card className="animate-rise flex items-center gap-3 p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-3"><DoorClosed className="h-6 w-6" aria-hidden /></span>
        <div><div className="text-lg font-semibold">Stand geschlossen</div><div className="text-sm text-ink-3">Heute ist noch kein Standbuch offen.</div></div>
      </Card>
    );
  }
  return (
    <Card className="animate-rise divide-y divide-line overflow-hidden">
      {days.map((d) => (
        <div key={d.id} className="flex items-center gap-3 p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ok/10 text-ok"><DoorOpen className="h-6 w-6" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="text-lg font-semibold">Stand offen</span><Badge tone="ok">{dayTitle(d)}</Badge></div>
            <div className="truncate text-sm text-ink-3">Standdienst: {d.dutyName ?? "–"} · seit {fmtTime(d.openedAt)} · {d._count.visits} {d._count.visits === 1 ? "Person" : "Personen"} am Stand</div>
          </div>
        </div>
      ))}
    </Card>
  );
}
