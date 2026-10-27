import Link from "next/link";
import { ArrowRight, Crosshair, Star, Target, Trophy } from "lucide-react";
import { getAppContext } from "@/lib/tenant";
import { MODULES } from "@/lib/modules";
import { Badge, Card, EmptyState, LinkButton, SectionTitle } from "@/components/ui";
import { listMatches, listPrograms, userStats } from "@/modules/scores/queries";
import { listMyBookings, partitionBookings } from "@/modules/bookings/queries";
import { formatDateZurich, formatTimeRange } from "@/lib/time";
import { CalendarDays } from "lucide-react";
import { formatDate, formatScore } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ module?: string; denied?: string }> }) {
  const ctx = await getAppContext();
  if (!ctx.tenant) redirect("/onboarding");
  const tenantCtx = ctx as typeof ctx & { tenant: NonNullable<typeof ctx.tenant> };
  const sp = await searchParams;

  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend";
  const firstName = ctx.user.name.split(" ")[0];

  const scoresOn = ctx.hasModule("scores");
  const [favorites, recent, stats] = scoresOn
    ? await Promise.all([
        listPrograms(tenantCtx).then((p) => p.filter((x) => x.favorite).slice(0, 4)),
        listMatches(tenantCtx, { limit: 3 }),
        userStats(tenantCtx),
      ])
    : [[], [], null];

  const enabled = MODULES.filter((m) => ctx.hasModule(m.key));
  const nextBookings = ctx.hasModule("bookings")
    ? partitionBookings(await listMyBookings(tenantCtx)).upcoming.slice(0, 2)
    : [];

  return (
    <div>
      <div className="animate-rise mb-6">
        <p className="text-ink-3 text-sm">{ctx.tenant.name}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{greeting}, {firstName}.</h1>
      </div>

      {sp.module ? <div className="mb-4"><Badge tone="warn">Dieses Modul ist in {ctx.tenant.name} nicht aktiviert.</Badge></div> : null}
      {sp.denied ? <div className="mb-4"><Badge tone="warn">Dafür fehlt dir die Berechtigung.</Badge></div> : null}

      {scoresOn ? (
        <>
          <SectionTitle action={<Link href="/scores/programs" className="text-xs text-ink-3 hover:text-ink">Alle Programme</Link>}>Schnellstart</SectionTitle>
          {favorites.length ? (
            <div className="stagger grid gap-2.5 sm:grid-cols-2">
              {favorites.map((p) => (
                <Link key={p.id} href={`/scores/matches/new?programId=${p.id}`} className="press">
                  <Card className="p-4 h-full flex items-center gap-3 hover:border-ink/30 transition-colors">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Star className="h-5 w-5 fill-current" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-ink-3">{p.totals.shots} Schuss · {p.stages.length} Serien</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-ink-3" />
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Star className="h-5 w-5" />} title="Noch keine Favoriten" text="Markiere Programme mit dem Stern, dann erscheinen sie hier zum Schnellstart."
              action={<LinkButton href="/scores/programs" variant="secondary" size="sm">Programme ansehen</LinkButton>} />
          )}

          {stats && stats.matches > 0 ? (
            <>
              <SectionTitle action={<Link href="/scores/stats" className="text-xs text-ink-3 hover:text-ink">Statistik</Link>}>Deine Zahlen</SectionTitle>
              <div className="stagger grid grid-cols-3 gap-2.5">
                <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{stats.matches}</div><div className="text-xs text-ink-3">Durchgänge</div></Card>
                <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{stats.totalShots}</div><div className="text-xs text-ink-3">Schüsse</div></Card>
                <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{stats.byProgram.length}</div><div className="text-xs text-ink-3">Programme</div></Card>
              </div>
            </>
          ) : null}

          <SectionTitle action={<Link href="/scores/matches" className="text-xs text-ink-3 hover:text-ink">Alle</Link>}>Letzte Durchgänge</SectionTitle>
          {recent.length ? (
            <div className="stagger space-y-2.5">
              {recent.map((m) => (
                <Link key={m.id} href={`/scores/matches/${m.id}`} className="block press">
                  <Card className="p-4 hover:border-ink/30 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{m.title ?? m.program.name}</div>
                        <div className="text-xs text-ink-3">{formatDate(m.date)} · {m.participants.map((p) => p.name).join(", ")}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-semibold tabular-nums">{formatScore(Math.max(...m.participants.map((p) => p.total)), m.program.scoringMode === "RINGS_DECIMAL")}</div>
                        <div className="text-[11px] text-ink-3">von {m.maxScore}</div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Trophy className="h-5 w-5" />} title="Noch nichts geschossen" text="Starte deinen ersten Durchgang."
              action={<LinkButton href="/scores/matches/new" size="sm"><Crosshair className="h-4 w-4" /> Durchgang starten</LinkButton>} />
          )}
        </>
      ) : null}

      {ctx.hasModule("bookings") ? (
        <>
          <SectionTitle action={<Link href="/bookings" className="text-xs text-ink-3 hover:text-ink">Reservieren</Link>}>Nächste Reservation</SectionTitle>
          {nextBookings.length ? (
            <div className="stagger space-y-2.5">
              {nextBookings.map((b) => (
                <Link key={b.id} href={`/bookings/${b.id}`} className="block press">
                  <Card className="p-4 flex items-center gap-3 hover:border-ink/30 transition-colors">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2"><CalendarDays className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1"><div className="font-medium truncate">{b.resource.name}</div><div className="text-xs text-ink-3">{formatDateZurich(b.startsAt)} · {formatTimeRange(b.startsAt, b.endsAt)}{b.status === "PENDING" ? " · wartet auf Freigabe" : ""}</div></div>
                    <ArrowRight className="h-4 w-4 text-ink-3" />
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Keine Reservation geplant" action={<LinkButton href="/bookings" variant="secondary" size="sm">Jetzt reservieren</LinkButton>} />
          )}
        </>
      ) : null}

      <SectionTitle>Module</SectionTitle>
      <div className="stagger grid gap-2.5 sm:grid-cols-2">
        {enabled.map((m) => (
          <Link key={m.key} href={m.href} className="press">
            <Card className="p-4 h-full hover:border-ink/30 transition-colors">
              <div className="flex items-center gap-2">
                {m.key === "scores" ? <Crosshair className="h-4 w-4" /> : m.key === "targets" ? <Target className="h-4 w-4" /> : m.key === "bookings" ? <CalendarDays className="h-4 w-4" /> : null}
                <span className="font-medium">{m.name}</span>
                {m.status === "planned" ? <Badge tone="outline">bald</Badge> : null}
              </div>
              <p className="text-sm text-ink-3 mt-1">{m.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
