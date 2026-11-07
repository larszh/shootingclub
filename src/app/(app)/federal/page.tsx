import type { Metadata } from "next";
import Link from "next/link";
import { Award, BadgeCheck, CalendarClock, Download, FileText, Flag, Printer, ShieldCheck, Trophy, Users } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Input, LinkButton, LinkTabs, PageHeader, SectionTitle, Select, StatCard } from "@/components/ui";
import { formatScore } from "@/lib/utils";
import { OFFICIAL_KINDS } from "@/modules/scores/types";
import {
  canEditYear,
  canSeeAll,
  currentMembers,
  currentSwissYear,
  getFederalYear,
  listOfficialPrograms,
  listOfficialResults,
  listOpEvents,
  nowDate,
  requireFederal,
  type OfficialResultRow,
} from "@/modules/federal/queries";
import {
  DEADLINE_FIELDS,
  daysBetween,
  formatSwissDate,
  opStatusByUser,
  parseYear,
  rankFs,
  swissDay,
  summarizeOp,
  yearOptions,
} from "@/modules/federal/types";
import { FederalYearForm } from "@/modules/federal/ui/year-form";
import { fsAwardsOverview } from "@/modules/federal/awards-queries";
import { formatDate, getRequestLocale, getT, type Locale, type TFunction } from "@/lib/i18n";
import { dayKeyLabel } from "@/lib/i18n/extra/admin2/msg";
import { officialKindText, tCount } from "@/modules/scores/ui/labels";
import { StartFederalMatchForm } from "@/modules/federal/ui/start-match-form";
import { localizedProgramName } from "@/modules/scores/preset-i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.federal.title") };
}

/** Datum eines Anlasses (mit Uhrzeit, ausser ganztägig) im Format der Sprache. */
function eventDate(d: Date, allDay: boolean, locale: Locale): string {
  return formatDate(d, locale, allDay ? { weekday: "short" } : { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

type SP = { year?: string; kind?: string; status?: string; eventId?: string; q?: string; denied?: string };

function PassBadge({ passed, t }: { passed: boolean | null; t: TFunction }) {
  if (passed === true) return <Badge tone="ok">{t("shooting.federal.pass.passed")}</Badge>;
  if (passed === false) return <Badge tone="danger">{t("shooting.federal.pass.failed")}</Badge>;
  return <Badge tone="outline">{t("shooting.federal.pass.none")}</Badge>;
}

function ResultItem({ r, showName, t, locale }: { r: OfficialResultRow; showName: boolean; t: TFunction; locale: Locale }) {
  const program = localizedProgramName(r.program, locale);
  return (
    <Link href={`/scores/matches/${r.matchId}`} className="press flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{showName ? r.name : program}</div>
        <div className="text-xs text-ink-3 truncate">
          {formatSwissDate(r.date)} · {showName ? `${program} · ` : ""}{officialKindText(t, r.kind)}{r.attempt ? t("shooting.federal.attempt", { n: r.attempt }) : ""}{r.eventTitle ? ` · ${r.eventTitle}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-semibold tabular-nums">{r.total === null ? "–" : formatScore(r.total, r.decimal)}</div>
        <div className="text-[11px] text-ink-3 tabular-nums">{t("shooting.federal.zeros", { n: r.zeros ?? 0 })}</div>
      </div>
      <div className="shrink-0"><PassBadge passed={r.passed} t={t} /></div>
    </Link>
  );
}

export default async function FederalPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireFederal();
  const sp = await searchParams;
  const now = nowDate();
  const thisYear = currentSwissYear(now);
  const year = parseYear(sp.year, thisYear);
  const today = swissDay(now);
  const all = canSeeAll(ctx);
  const canVerify = ctx.can("results.verify");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const yearTabs = yearOptions(thisYear).map((y) => ({ value: String(y), href: `/federal?year=${y}`, label: String(y) }));

  const [fy, events, myResults] = await Promise.all([
    getFederalYear(ctx.tenant.id, year),
    listOpEvents(ctx.tenant.id, year),
    listOfficialResults(ctx.tenant.id, year, { userId: ctx.user.id }),
  ]);
  const myOp = myResults.filter((r) => r.kind === "OP");
  const myStatus = opStatusByUser(myOp.map((r) => ({ userId: r.userId, passed: r.passed, attempt: r.attempt, date: r.date }))).get(ctx.user.id);

  const deadlineRows = DEADLINE_FIELDS.map((f) => {
    const day = fy[f.key];
    const left = day ? daysBetween(today, day) : null;
    return { ...f, day, left };
  });

  const header = (
    <PageHeader
      title={t("shooting.federal.title")}
      subtitle={t("shooting.federal.subtitle", { club: ctx.tenant.name, year })}
      action={<LinkButton href="/federal/nachweis" variant="secondary" size="sm" className="h-11"><FileText className="h-4 w-4" aria-hidden /> {t("shooting.federal.nachweis")}</LinkButton>}
    />
  );

  // ---- Ansicht für Mitglieder: eigener Stand ------------------------------------
  const mine = (
    <>
      <SectionTitle>{t("shooting.federal.myOp", { year })}</SectionTitle>
      <Card className="animate-rise p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><ShieldCheck className="h-5 w-5" aria-hidden /></span>
          <div className="min-w-0">
            <div className="font-semibold">
              {myStatus?.status === "passed" ? t("shooting.federal.status.passed") : myStatus?.status === "failed" ? t("shooting.federal.status.failed") : myStatus ? t("shooting.federal.status.recorded") : t("shooting.federal.status.none")}
            </div>
            <div className="text-xs text-ink-3">
              {myStatus ? tCount(t, "shooting.federal.attempts", myStatus.attempts, { date: formatSwissDate(myStatus.lastDate) }) : t("shooting.federal.waiting")}
            </div>
          </div>
          {myStatus?.status === "passed" ? <Badge tone="ok" className="ml-auto">{t("shooting.federal.pass.passed")}</Badge> : myStatus?.status === "failed" ? <Badge tone="danger" className="ml-auto">{t("shooting.federal.remained")}</Badge> : null}
        </div>
        {myStatus?.status === "failed" ? (
          <p className="mt-3 text-sm text-ink-2">{t("shooting.federal.retry")}</p>
        ) : null}
      </Card>
      {myResults.length ? (
        <Card className="animate-rise mt-3 divide-y divide-line overflow-hidden">
          {myResults.map((r) => <ResultItem key={r.id} r={r} showName={false} t={t} locale={locale} />)}
        </Card>
      ) : null}
    </>
  );

  const eventsList = (
    <>
      <SectionTitle>{t("shooting.federal.days", { year })}</SectionTitle>
      {events.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {events.map((e) => (
            <div key={e.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/events/${e.id}`} className="min-w-0 hover:underline">
                  <div className="font-medium truncate">{e.title}</div>
                  <div className="text-xs text-ink-3">{eventDate(e.startsAt, e.allDay, locale)}{e.location ? ` · ${e.location}` : ""}</div>
                </Link>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {e.isCancelled ? <Badge tone="warn">{t("shooting.federal.cancelled")}</Badge> : null}
                  {e.yesCount ? <Badge tone="outline"><Users className="mr-1 h-3 w-3" aria-hidden />{e.yesCount}</Badge> : null}
                </div>
              </div>
              {all && e.matches.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {e.matches.map((m) => (
                    <LinkButton key={m.id} href={`/scores/matches/${m.id}`} variant="secondary" size="sm" className="h-11">
                      {t("shooting.federal.confirmedCount", { name: localizedProgramName(m.programName, locale), official: m.officialCount, total: m.participantCount })}
                    </LinkButton>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState icon={<CalendarClock className="h-5 w-5" />} title={t("shooting.federal.noDays")} text={t("shooting.federal.noDaysText")} />
      )}
    </>
  );

  if (!all) {
    return (
      <div>
        {header}
        <LinkTabs items={yearTabs} active={String(year)} label={t("shooting.federal.yearAria")} className="mb-4" />
        {mine}
        {eventsList}
        <p className="mt-6 text-xs text-ink-3">{t("shooting.federal.responsibility")}</p>
      </div>
    );
  }

  // ---- Ansicht für Schützenmeister und Vorstand -----------------------------------
  const kindFilter = OFFICIAL_KINDS.some((k) => k.key === sp.kind) ? sp.kind : "";
  const statusFilter = ["passed", "failed", "none"].includes(sp.status ?? "") ? sp.status : "";
  const eventFilter = events.some((e) => e.id === sp.eventId) ? sp.eventId : "";
  const q = (sp.q ?? "").slice(0, 60);

  const [opResults, filtered, fsAwards, members, programs] = await Promise.all([
    listOfficialResults(ctx.tenant.id, year, { kind: "OP" }),
    listOfficialResults(ctx.tenant.id, year, { kind: kindFilter || undefined, status: statusFilter || undefined, eventId: eventFilter || undefined, q: q || undefined }),
    fsAwardsOverview(ctx.tenant.id, year),
    currentMembers(ctx.tenant.id),
    canVerify ? listOfficialPrograms(ctx.tenant.id) : Promise.resolve([]),
  ]);
  const lite = opResults.map((r) => ({ userId: r.userId, passed: r.passed, attempt: r.attempt, date: r.date }));
  const summary = summarizeOp(lite);
  const statusMap = opStatusByUser(lite);
  const memberNames = new Map(members.map((m) => [m.userId, m.name]));
  const remaining = [...statusMap.values()]
    .filter((s) => s.status === "failed" && memberNames.has(s.userId))
    .map((s) => ({ ...s, name: memberNames.get(s.userId)! }))
    .sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
  const fs = fsAwards.participants;
  const fsRanked = rankFs(fs);
  const openEvents = events.filter((e) => !e.isCancelled);
  const exportQs = new URLSearchParams({ year: String(year), ...(kindFilter ? { kind: kindFilter } : {}), ...(eventFilter ? { eventId: eventFilter } : {}) }).toString();
  const shown = filtered.slice(0, 300);

  return (
    <div>
      {header}
      {sp.denied ? <Alert tone="warn" className="mb-4">{t("adm2.federal.p.denied")}</Alert> : null}
      <LinkTabs items={yearTabs} active={String(year)} label={t("shooting.federal.yearAria")} className="mb-4" />

      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("adm2.federal.p.confirmed")} value={summary.confirmed} hint={t("adm2.federal.p.op")} icon={<BadgeCheck className="h-4 w-4" />} />
        <StatCard label={t("adm2.federal.p.passed")} value={summary.passed} hint={t("adm2.federal.p.ofShooters", { n: summary.shooters })} tone="accent" icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label={t("adm2.federal.p.remained")} value={summary.failed} hint={t("adm2.federal.p.notPassed")} tone={summary.failed ? "warn" : "neutral"} icon={<Flag className="h-4 w-4" />} />
        <StatCard label={t("adm2.federal.p.fs")} value={fs.length} hint={t("adm2.federal.p.participations")} icon={<Trophy className="h-4 w-4" />} />
      </div>
      {summary.unknown ? <p className="mt-2 text-xs text-ink-3">{t(summary.unknown === 1 ? "adm2.federal.p.unknown.one" : "adm2.federal.p.unknown.other", { n: summary.unknown })}</p> : null}

      {/* Fristen */}
      <SectionTitle>{t("adm2.federal.p.deadlines", { year })}</SectionTitle>
      <Card className="animate-rise p-4 space-y-3">
        <ul className="space-y-2">
          {deadlineRows.map((d) => (
            <li key={d.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink-2">{t(`adm2.federal.dl.${d.key}`)}</span>
              {d.day ? (
                <span className="flex items-center gap-2">
                  <span className="tabular-nums font-medium">{dayKeyLabel(d.day, locale)}</span>
                  {d.left !== null && d.left >= 0 && d.left <= 14 ? <Badge tone={d.left <= 3 ? "danger" : "warn"}>{d.left === 0 ? t("adm2.federal.p.today") : t("adm2.federal.p.inDays", { n: d.left })}</Badge> : d.left !== null && d.left < 0 ? <Badge tone="outline">{t("adm2.federal.p.past")}</Badge> : null}
                </span>
              ) : (
                <span className="text-ink-3">{t("adm2.federal.p.notSet")}</span>
              )}
            </li>
          ))}
        </ul>
        {fy.notes ? <p className="whitespace-pre-line border-t border-line pt-3 text-sm text-ink-2">{fy.notes}</p> : null}
        {canEditYear(ctx) ? (
          <details className="border-t border-line pt-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">{t("adm2.federal.p.editDeadlines")}</summary>
            <div className="mt-3"><FederalYearForm year={year} values={fy} /></div>
          </details>
        ) : (
          <p className="text-xs text-ink-3">{t("adm2.federal.rulesHint")}</p>
        )}
      </Card>

      {eventsList}
      {canVerify ? (
        <Card className="animate-rise mt-3 p-4 space-y-3">
          <div>
            <h2 className="font-semibold">{t("adm2.federal.p.startTitle")}</h2>
            <p className="text-xs text-ink-3">{t("adm2.federal.p.startText")}</p>
          </div>
          <StartFederalMatchForm
            events={openEvents.map((e) => ({ id: e.id, label: `${formatDate(e.startsAt, locale)} · ${e.title}`, yesCount: e.yesCount }))}
            programs={programs.map((p) => ({ id: p.id, name: localizedProgramName(p.name, locale), kindLabel: officialKindText(t, p.officialKind), isOp: p.officialKind === "OP" }))}
            defaultEventId={openEvents.find((e) => swissDay(e.startsAt) >= today)?.id}
          />
        </Card>
      ) : null}

      {/* Verbliebene */}
      <SectionTitle>{t("adm2.federal.p.notPassedTitle")}</SectionTitle>
      {remaining.length ? (
        <>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {remaining.map((s) => (
              <Link key={s.userId} href={`/federal?year=${year}&kind=OP&q=${encodeURIComponent(s.name)}`} className="press flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2/60">
                <span className="min-w-0">
                  <span className="block font-medium truncate">{s.name}</span>
                  <span className="block text-xs text-ink-3">{t("adm2.federal.p.lastOn", { date: formatDate(s.lastDate, locale) })}</span>
                </span>
                <Badge tone="warn">{t(s.attempts === 1 ? "adm2.federal.p.attempts.one" : "adm2.federal.p.attempts.other", { n: s.attempts })}</Badge>
              </Link>
            ))}
          </Card>
          <p className="mt-2 text-xs text-ink-3">{t("adm2.federal.p.retryHint")}</p>
        </>
      ) : (
        <Card className="animate-rise p-4 text-sm text-ink-3">{t("adm2.federal.p.nobodyLeft")}</Card>
      )}

      {/* Feldschiessen */}
      <SectionTitle action={<LinkButton href={`/federal/awards?year=${year}`} variant="secondary" size="sm" className="h-11"><Award className="h-4 w-4" aria-hidden /> {t("adm2.federal.p.awards")}</LinkButton>}>{t("adm2.federal.p.fsYear", { year })}</SectionTitle>
      {fsRanked.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {fsRanked.map((r) => (
            <Link key={r.id} href={`/scores/matches/${r.matchId}`} className="press flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
              <span className="w-8 shrink-0 text-center text-sm font-semibold tabular-nums text-ink-3">{r.rank}.</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium truncate">{r.name}{r.isGuest ? <span className="ml-1 text-xs text-ink-3">{t("adm2.federal.p.guest")}</span> : null}</span>
                <span className="block text-xs text-ink-3 truncate">{formatDate(r.date, locale)} · {localizedProgramName(r.program, locale)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold tabular-nums">{formatScore(r.total, r.decimal)}</span>
                <span className="block text-[11px] text-ink-3 tabular-nums">{t("shooting.federal.zeros", { n: r.zeros ?? 0 })}</span>
              </span>
              {(() => {
                const a = fsAwards.byParticipant.get(r.id);
                return a?.status === "award" ? <Badge tone="ok" className="shrink-0">{a.award}</Badge> : null;
              })()}
              {r.isOfficial ? <BadgeCheck className="h-4 w-4 shrink-0 text-accent" aria-label={t("adm2.federal.p.officialAria")} /> : <span className="w-4 shrink-0" />}
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState icon={<Trophy className="h-5 w-5" />} title={t("adm2.federal.p.noFs")} text={t("adm2.federal.p.noFsText")} />
      )}

      {/* Amtliche Resultate */}
      <SectionTitle
        action={canVerify ? (
          <span className="flex gap-2">
            <LinkButton href={`/api/export/federal?${exportQs}`} variant="secondary" size="sm" className="h-11"><Download className="h-4 w-4" aria-hidden /> CSV</LinkButton>
            <LinkButton href={`/federal/print?${exportQs}`} target="_blank" variant="secondary" size="sm" className="h-11"><Printer className="h-4 w-4" aria-hidden /> {t("adm2.federal.p.print")}</LinkButton>
          </span>
        ) : undefined}
      >
        {t("adm2.federal.p.official")}
      </SectionTitle>
      <form method="get" className="animate-rise mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <input type="hidden" name="year" value={year} />
        <Select name="kind" defaultValue={kindFilter} aria-label={t("adm2.federal.p.kind")} className="h-11">
          <option value="">{t("adm2.federal.p.allKinds")}</option>
          {OFFICIAL_KINDS.map((k) => <option key={k.key} value={k.key}>{officialKindText(t, k.key)}</option>)}
        </Select>
        <Select name="status" defaultValue={statusFilter} aria-label={t("adm2.common.status")} className="h-11">
          <option value="">{t("adm2.common.all")}</option>
          <option value="passed">{t("adm2.federal.p.passed")}</option>
          <option value="failed">{t("shooting.federal.status.failed")}</option>
          <option value="none">{t("adm2.federal.p.none")}</option>
        </Select>
        <Select name="eventId" defaultValue={eventFilter} aria-label={t("adm2.federal.p.event")} className="h-11">
          <option value="">{t("adm2.federal.p.allEvents")}</option>
          {events.map((e) => <option key={e.id} value={e.id}>{formatDate(e.startsAt, locale)} · {e.title}</option>)}
        </Select>
        <Input name="q" defaultValue={q} placeholder={t("adm2.federal.p.searchName")} aria-label={t("adm2.federal.p.searchName")} className="h-11" />
        <Button type="submit" variant="secondary" className="col-span-2 h-11 sm:col-span-1">{t("adm2.federal.p.filter")}</Button>
      </form>
      {shown.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {shown.map((r) => <ResultItem key={r.id} r={r} showName t={t} locale={locale} />)}
        </Card>
      ) : (
        <EmptyState icon={<BadgeCheck className="h-5 w-5" />} title={t("adm2.federal.p.noOfficial")} text={t("adm2.federal.p.noOfficialText")} />
      )}
      {filtered.length > shown.length ? <p className="mt-2 text-xs text-ink-3">{t("adm2.federal.p.shownOf", { n: shown.length, total: filtered.length })}</p> : null}
      {canVerify ? <p className="mt-2 text-xs text-ink-3">{t("adm2.federal.p.satHint")}</p> : null}

      {mine}

      <Alert tone="info" className="mt-6">{t("adm2.federal.responsibility")} {t("adm2.federal.p.fsHint")}</Alert>
    </div>
  );
}
