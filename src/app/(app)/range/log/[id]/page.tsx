import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ActionButton } from "@/components/ui/action-button";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { requireRangeDuty } from "@/modules/range/guard";
import { getActiveRules, getRangeDayDetail } from "@/modules/range/queries";
import { toBoardVisits } from "@/modules/range/board";
import { reopenDayAction } from "@/modules/range/actions";
import { dayTitle, flagsLabel, fmtDay, fmtTimeOn } from "@/modules/range/format";
import { dbDateKey } from "@/modules/range/logic";
import { DayCorrection } from "@/modules/range/ui/day-correction";

export const metadata: Metadata = { title: "Standbuch-Tag" };

export default async function RangeLogDayPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRangeDuty();
  const { id } = await params;
  const board = await getRangeDayDetail(ctx.tenant.id, id);
  if (!board) notFound();
  const { day } = board;
  const rules = await getActiveRules(ctx.tenant.id);
  const memberIds = day.visits.map((v) => v.userId).filter((x): x is string => !!x);
  const accepted = rules && memberIds.length ? await db.rulesAcceptance.findMany({ where: { rulesId: rules.id, userId: { in: memberIds } }, select: { userId: true } }) : [];
  const visits = toBoardVisits(board, rules?.id ?? null, new Set(accepted.map((a) => a.userId)));
  const isManager = ctx.can("range.manage");

  return (
    <div className="space-y-4">
      <PageHeader
        title={fmtDay(day.date, { weekday: "long", month: "long" })}
        subtitle={`${dayTitle(day)} · Standdienst: ${day.dutyName ?? "–"}`}
        back={{ href: "/range/log", label: "Standbuch" }}
        action={<LinkButton href={`/range/log/${day.id}/print`} variant="secondary" size="sm" className="h-11" target="_blank" aria-label="Drucken"><Printer className="h-4 w-4" /></LinkButton>}
      />
      <Card className="grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
        <div><div className="text-xs text-ink-3">Geöffnet</div><div className="font-medium">{fmtTimeOn(day.openedAt, dbDateKey(day.date))}</div></div>
        <div><div className="text-xs text-ink-3">Abgeschlossen</div><div className="font-medium">{day.closedAt ? fmtTimeOn(day.closedAt, dbDateKey(day.date)) : <Badge tone="accent">offen</Badge>}</div></div>
        <div><div className="text-xs text-ink-3">Besuche</div><div className="font-medium">{visits.length} ({visits.filter((v) => v.isGuest).length} Gäste)</div></div>
        <div><div className="text-xs text-ink-3">Halbtage</div><div className="font-medium">{day.closedAt ? flagsLabel(day) : "–"}</div></div>
      </Card>
      {day.notes && !isManager ? <Card className="whitespace-pre-line p-4 text-sm text-ink-2">{day.notes}</Card> : null}

      <SectionTitle>Besuche</SectionTitle>
      {visits.length ? (
        <Card className="divide-y divide-line overflow-hidden">
          {visits.map((v) => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={v.name} src={v.avatarUrl} size={36} tone={v.isGuest ? "guest" : "soft"} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{v.name}</div>
                <div className="truncate text-xs text-ink-3">{v.inLabel}–{v.outLabel ?? "…"}{v.lane ? ` · Bahn ${v.lane}` : ""}{v.discipline ? ` · ${v.discipline}` : ""}{v.hostName ? ` · Gast von ${v.hostName}` : ""}</div>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                {v.isGuest ? <Badge tone="accent">Gast</Badge> : null}
                {v.weapon ? <Badge tone="outline">{v.weapon.name}</Badge> : null}
              </div>
            </div>
          ))}
        </Card>
      ) : <EmptyState title="Keine Besuche" />}

      {isManager && day.closedAt ? (
        <>
          <DayCorrection dayId={day.id} flags={{ usedAm: day.usedAm, usedPm: day.usedPm, usedEvening: day.usedEvening }} notes={day.notes} />
          <ActionButton variant="ghost" className="w-full" action={reopenDayAction.bind(null, day.id)} confirm={{ title: "Standbuch wieder öffnen?", message: "Nur bei versehentlichem Abschluss. Die Halbtage werden beim erneuten Abschliessen neu gesetzt.", confirmLabel: "Öffnen" }}>
            Wieder öffnen
          </ActionButton>
        </>
      ) : null}
    </div>
  );
}
