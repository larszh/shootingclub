import type { Metadata } from "next";
import Link from "next/link";
import { Download, Landmark } from "lucide-react";
import { todayZurich } from "@/lib/time";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, SectionTitle, Select, StatCard } from "@/components/ui";
import { currentSwissYear } from "@/modules/federal/queries";
import { formatDay, parseYear, yearOptions } from "@/modules/federal/types";
import { listAssociationMembers, loadClubStats, requireAssociation, sharingScope } from "@/modules/association/queries";
import { nextDeadline, passRate, sumClubStats, type DeadlineView } from "@/modules/association/stats";
import { AssociationTabs } from "./tabs";

export const metadata: Metadata = { title: "Verband" };

function DeadlineBadge({ d }: { d: DeadlineView }) {
  const tone = d.status === "today" || d.status === "soon" ? "warn" : d.status === "past" ? "neutral" : "outline";
  const when = d.status === "today" ? "heute" : d.status === "past" ? "vorbei" : `in ${d.daysLeft} T.`;
  return <Badge tone={tone}>{d.label}: {formatDay(d.day)} ({when})</Badge>;
}

export default async function AssociationDashboardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string }> }) {
  const { id } = await params;
  const ctx = await requireAssociation(id);
  const sp = await searchParams;
  const nowYear = currentSwissYear();
  const year = parseYear(sp.year, nowYear);
  const today = todayZurich();

  const members = await listAssociationMembers(ctx.association.id);
  const scope = sharingScope(ctx.access, members);
  const rows = await loadClubStats(scope.readable, scope.names, year, today);
  const sum = sumClubStats(rows);
  const pending = members.filter((m) => m.status === "PENDING" && !m.tenantDeletedAt).length;
  const rate = passRate(sum.op);

  return (
    <div>
      <PageHeader
        title={ctx.association.name}
        subtitle={`${ctx.association.region ? `${ctx.association.region} · ` : ""}${sum.clubs} aktive Vereine · ${year}`}
        back={{ href: "/association", label: "Verband" }}
      />
      <AssociationTabs id={ctx.association.id} active="overview" pending={pending} />
      {ctx.association.deletedAt ? <Alert tone="warn" className="mb-4">Dieser Verband ist gelöscht. Nur Super-Admins sehen ihn noch.</Alert> : null}
      {pending ? (
        <Alert tone="info" className="mb-4">
          {pending === 1 ? "1 Verein wartet" : `${pending} Vereine warten`} auf Freigabe. <Link href={`/association/${ctx.association.id}/clubs`} className="underline">Ansehen</Link>
        </Alert>
      ) : null}

      <form method="get" className="mb-4 flex items-end gap-2.5">
        <label className="flex-1 max-w-48">
          <span className="block text-sm text-ink-3 mb-1">Jahr</span>
          <Select name="year" defaultValue={String(year)}>
            {yearOptions(nowYear).map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </label>
        <Button type="submit" variant="secondary">Anzeigen</Button>
        <a href={`/association/${ctx.association.id}/export?kind=stats&year=${year}`} className="press ml-auto inline-flex h-11 items-center gap-2 rounded-control border border-line px-3 text-sm font-medium" download>
          <Download className="h-4 w-4" aria-hidden /> CSV
        </a>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={<Landmark className="h-6 w-6" />} title="Noch keine aktiven Vereine" text="Vereine treten mit dem Code des Verbands bei. Nach der Freigabe erscheinen hier ihre Kennzahlen." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatCard label="Mitglieder" value={sum.members.total} hint={`${sum.members.active} aktiv · ${sum.members.juniors} Junioren`} />
            <StatCard label="Obligatorisch" value={sum.op.shooters} hint={`${sum.op.passed} bestanden${rate !== null ? ` (${rate} %)` : ""}`} tone="accent" />
            <StatCard label="Verblieben" value={sum.op.remaining} hint={`${sum.op.notPassedResults} nicht bestandene Versuche`} tone={sum.op.remaining ? "warn" : "neutral"} />
            <StatCard label="Feldschiessen" value={sum.fs.participants} hint={`${sum.fs.confirmed} bestätigt`} />
          </div>
          {sum.unconfirmed ? <p className="mt-2 text-sm text-ink-3">{sum.unconfirmed} Resultate (OP/FS) sind in den Vereinen noch nicht bestätigt und nicht in der Obligatorisch-Statistik enthalten.</p> : null}

          <SectionTitle>Vereine</SectionTitle>
          <div className="space-y-2.5">
            {rows.map((r) => {
              const next = nextDeadline(r.deadlines);
              const clubRate = passRate(r.op);
              return (
                <Card key={r.tenantId} className="animate-rise p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium">{r.clubName}</div>
                    {r.unconfirmed ? <Badge tone="warn">{r.unconfirmed} unbestätigt</Badge> : null}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                    <div><dt className="text-ink-3">Mitglieder</dt><dd className="tabular-nums">{r.members.total} <span className="text-ink-3">({r.members.active} aktiv, {r.members.juniors} Jun.)</span></dd></div>
                    <div><dt className="text-ink-3">OP Schützen</dt><dd className="tabular-nums">{r.op.shooters}{clubRate !== null ? <span className="text-ink-3"> · {clubRate} %</span> : null}</dd></div>
                    <div><dt className="text-ink-3">Bestanden / verblieben</dt><dd className="tabular-nums">{r.op.passed} / {r.op.remaining}{r.op.unknown ? <span className="text-ink-3"> · {r.op.unknown} ohne Regel</span> : null}</dd></div>
                    <div><dt className="text-ink-3">Feldschiessen</dt><dd className="tabular-nums">{r.fs.participants} <span className="text-ink-3">({r.fs.guests} Gäste)</span></dd></div>
                  </dl>
                  {r.deadlines.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {next ? <DeadlineBadge d={next} /> : <Badge tone="neutral">Alle Fristen {year} vorbei</Badge>}
                    </div>
                  ) : <p className="mt-3 text-xs text-ink-3">Keine Fristen für {year} erfasst.</p>}
                </Card>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-ink-3">
            Obligatorisch: nur vom Verein bestätigte amtliche Resultate. «Verblieben» = Schützen ohne bestandenes Resultat. Junioren: Status Junior oder höchstens 20 Jahre alt im Jahr {year}.
            Es werden nur Zahlen geteilt, keine Personendaten.
          </p>
        </>
      )}
    </div>
  );
}
