import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MonitorPlay } from "lucide-react";
import { Alert, Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { formatDateTimeZurich, formatDateZurich, todayZurich } from "@/lib/time";
import { liveFormOptions, listLiveBoards, nowDate, requireLiveAdmin } from "@/modules/live/admin";
import { isExpired } from "@/modules/live/logic";
import { LiveBoardForm } from "@/modules/live/ui/board-form";

export const metadata: Metadata = { title: "Live-Rangliste" };

export default async function LiveBoardsPage() {
  const ctx = await requireLiveAdmin();
  const now = nowDate();
  const today = todayZurich();
  const [boards, options] = await Promise.all([listLiveBoards(ctx.tenant.id), liveFormOptions(ctx.tenant.id, now)]);
  const active = boards.filter((b) => !isExpired(b.expiresAt, now));
  const past = boards.filter((b) => isExpired(b.expiresAt, now));
  const events = options.events.map((e) => ({ id: e.id, title: e.title, label: `${formatDateZurich(e.startsAt)} · ${e.title}` }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Live-Rangliste" subtitle="Rangliste auf dem TV oder Beamer im Schützenhaus" back={{ href: "/admin", label: "Verwaltung" }} />
      {!ctx.hasModule("scores") ? <Alert tone="warn" className="mb-4">Das Modul «Punkteerfassung» ist ausgeschaltet. Ohne erfasste Durchgänge bleibt die Rangliste leer.</Alert> : null}

      <Card className="mb-6 p-4">
        <h2 className="mb-1 font-semibold">Neue Live-Rangliste</h2>
        <p className="mb-4 text-sm text-ink-3">Du erhältst einen geheimen Link für den Bildschirm. Gezeigt werden abgeschlossene und laufende Durchgänge des Tages, Namen gekürzt als «Vorname N.».</p>
        <LiveBoardForm
          programs={options.programs}
          events={events}
          values={{ title: "Live-Rangliste", programId: "", eventId: "", date: today, showDecimals: false, expiresAt: `${today}T23:59` }}
        />
      </Card>

      <SectionTitle>Aktiv</SectionTitle>
      {active.length ? (
        <BoardList boards={active} now={now} />
      ) : (
        <EmptyState icon={<MonitorPlay className="h-5 w-5" />} title="Keine aktive Live-Rangliste" text="Lege oben eine an und öffne den Link auf dem Bildschirm im Schützenhaus." />
      )}
      {past.length ? (
        <>
          <SectionTitle>Abgelaufen</SectionTitle>
          <BoardList boards={past} now={now} />
        </>
      ) : null}
    </div>
  );
}

function BoardList({ boards, now }: { boards: Awaited<ReturnType<typeof listLiveBoards>>; now: Date }) {
  return (
    <Card className="mb-4 divide-y divide-line overflow-hidden">
      {boards.map((b) => {
        const expired = isExpired(b.expiresAt, now);
        return (
          <Link key={b.id} href={`/admin/live/${b.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2"><MonitorPlay className="h-5 w-5" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{b.title}</span>
                {expired ? <Badge tone="outline">abgelaufen</Badge> : <Badge tone="ok">aktiv</Badge>}
              </div>
              <div className="truncate text-xs text-ink-3">
                {[b.day ? b.day.split("-").reverse().join(".") : "heute", b.programName ?? "alle Programme", b.eventTitle].filter(Boolean).join(" · ")}
              </div>
              {b.expiresAt ? <div className="text-xs text-ink-3">bis {formatDateTimeZurich(b.expiresAt)}</div> : null}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          </Link>
        );
      })}
    </Card>
  );
}
