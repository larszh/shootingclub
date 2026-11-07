import type { Metadata } from "next";
import Link from "next/link";
import { Award, BadgeCheck, CalendarClock, Download, FileText, Flag, Printer, ShieldCheck, Trophy, Users } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Input, LinkButton, LinkTabs, PageHeader, SectionTitle, Select, StatCard } from "@/components/ui";
import { formatDateZurich } from "@/lib/time";
import { formatScore } from "@/lib/utils";
import { OFFICIAL_KINDS, officialKindLabel } from "@/modules/scores/types";
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
  FEDERAL_RESPONSIBILITY_HINT,
  FEDERAL_RULES_HINT,
  formatDay,
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
import { officialKindText, tCount } from "@/modules/scores/ui/labels";
import { StartFederalMatchForm } from "@/modules/federal/ui/start-match-form";

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

function ResultItem({ r, showName, t }: { r: OfficialResultRow; showName: boolean; t: TFunction }) {
  return (
    <Link href={`/scores/matches/${r.matchId}`} className="press flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{showName ? r.name : r.program}</div>
        <div className="text-xs text-ink-3 truncate">
          {formatSwissDate(r.date)} · {showName ? `${r.program} · ` : ""}{officialKindText(t, r.kind)}{r.attempt ? t("shooting.federal.attempt", { n: r.attempt }) : ""}{r.eventTitle ? ` · ${r.eventTitle}` : ""}
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
          {myResults.map((r) => <ResultItem key={r.id} r={r} showName={false} t={t} />)}
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
                      {t("shooting.federal.confirmedCount", { name: m.programName, official: m.officialCount, total: m.participantCount })}
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
      {sp.denied ? <Alert tone="warn" className="mb-4">Dafür fehlt dir die Berechtigung (Schützenmeister).</Alert> : null}
      <LinkTabs items={yearTabs} active={String(year)} label="Jahr wählen" className="mb-4" />

      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Bestätigte Resultate" value={summary.confirmed} hint="Obligatorisch" icon={<BadgeCheck className="h-4 w-4" />} />
        <StatCard label="Bestanden" value={summary.passed} hint={`von ${summary.shooters} Schützen`} tone="accent" icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label="Verblieben" value={summary.failed} hint="nicht bestanden" tone={summary.failed ? "warn" : "neutral"} icon={<Flag className="h-4 w-4" />} />
        <StatCard label="Feldschiessen" value={fs.length} hint="Teilnahmen" icon={<Trophy className="h-4 w-4" />} />
      </div>
      {summary.unknown ? <p className="mt-2 text-xs text-ink-3">{summary.unknown} {summary.unknown === 1 ? "Schütze" : "Schützen"} mit Resultat in einem Programm ohne Bestehensregel – bitte Grenzwerte im Programm eintragen.</p> : null}

      {/* Fristen */}
      <SectionTitle>Fristen {year}</SectionTitle>
      <Card className="animate-rise p-4 space-y-3">
        <ul className="space-y-2">
          {deadlineRows.map((d) => (
            <li key={d.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink-2">{d.label}</span>
              {d.day ? (
                <span className="flex items-center gap-2">
                  <span className="tabular-nums font-medium">{formatDay(d.day)}</span>
                  {d.left !== null && d.left >= 0 && d.left <= 14 ? <Badge tone={d.left <= 3 ? "danger" : "warn"}>{d.left === 0 ? "heute" : `in ${d.left} T.`}</Badge> : d.left !== null && d.left < 0 ? <Badge tone="outline">vorbei</Badge> : null}
                </span>
              ) : (
                <span className="text-ink-3">nicht eingetragen</span>
              )}
            </li>
          ))}
        </ul>
        {fy.notes ? <p className="whitespace-pre-line border-t border-line pt-3 text-sm text-ink-2">{fy.notes}</p> : null}
        {canEditYear(ctx) ? (
          <details className="border-t border-line pt-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Fristen und Notizen bearbeiten</summary>
            <div className="mt-3"><FederalYearForm year={year} values={fy} /></div>
          </details>
        ) : (
          <p className="text-xs text-ink-3">{FEDERAL_RULES_HINT}</p>
        )}
      </Card>

      {eventsList}
      {canVerify ? (
        <Card className="animate-rise mt-3 p-4 space-y-3">
          <div>
            <h2 className="font-semibold">Durchgang für Anlass starten</h2>
            <p className="text-xs text-ink-3">Erfasse die Resultate eines Schiesstags in einem Durchgang und bestätige sie danach pro Schütze amtlich.</p>
          </div>
          <StartFederalMatchForm
            events={openEvents.map((e) => ({ id: e.id, label: `${formatDateZurich(e.startsAt, { weekday: undefined })} · ${e.title}`, yesCount: e.yesCount }))}
            programs={programs.map((p) => ({ id: p.id, name: p.name, kindLabel: officialKindLabel(p.officialKind) }))}
            defaultEventId={openEvents.find((e) => swissDay(e.startsAt) >= today)?.id}
          />
        </Card>
      ) : null}

      {/* Verbliebene */}
      <SectionTitle>Noch nicht bestanden</SectionTitle>
      {remaining.length ? (
        <>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {remaining.map((s) => (
              <Link key={s.userId} href={`/federal?year=${year}&kind=OP&q=${encodeURIComponent(s.name)}`} className="press flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2/60">
                <span className="min-w-0">
                  <span className="block font-medium truncate">{s.name}</span>
                  <span className="block text-xs text-ink-3">zuletzt {formatSwissDate(s.lastDate)}</span>
                </span>
                <Badge tone="warn">{s.attempts} {s.attempts === 1 ? "Versuch" : "Versuche"}</Badge>
              </Link>
            ))}
          </Card>
          <p className="mt-2 text-xs text-ink-3">Wer das Obligatorisch nicht besteht, kann es je nach Vorgaben wiederholen bzw. muss einen Nachschiesskurs besuchen – gemäss Vorgaben. Bitte die Betroffenen rechtzeitig informieren.</p>
        </>
      ) : (
        <Card className="animate-rise p-4 text-sm text-ink-3">Niemand verblieben – alle Schützen mit amtlichem Resultat haben bestanden oder es liegt noch kein nicht bestandenes Resultat vor.</Card>
      )}

      {/* Feldschiessen */}
      <SectionTitle action={<LinkButton href={`/federal/awards?year=${year}`} variant="secondary" size="sm" className="h-11"><Award className="h-4 w-4" aria-hidden /> Auszeichnungen</LinkButton>}>Feldschiessen {year}</SectionTitle>
      {fsRanked.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {fsRanked.map((r) => (
            <Link key={r.id} href={`/scores/matches/${r.matchId}`} className="press flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
              <span className="w-8 shrink-0 text-center text-sm font-semibold tabular-nums text-ink-3">{r.rank}.</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium truncate">{r.name}{r.isGuest ? <span className="ml-1 text-xs text-ink-3">(Gast)</span> : null}</span>
                <span className="block text-xs text-ink-3 truncate">{formatSwissDate(r.date)} · {r.program}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold tabular-nums">{formatScore(r.total, r.decimal)}</span>
                <span className="block text-[11px] text-ink-3 tabular-nums">{r.zeros ?? 0} Nuller</span>
              </span>
              {(() => {
                const a = fsAwards.byParticipant.get(r.id);
                return a?.status === "award" ? <Badge tone="ok" className="shrink-0">{a.award}</Badge> : null;
              })()}
              {r.isOfficial ? <BadgeCheck className="h-4 w-4 shrink-0 text-accent" aria-label="amtlich bestätigt" /> : <span className="w-4 shrink-0" />}
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState icon={<Trophy className="h-5 w-5" />} title="Noch keine Feldschiessen-Resultate" text="Durchgänge mit einem Programm der Art «Feldschiessen» erscheinen hier als Rangliste." />
      )}

      {/* Amtliche Resultate */}
      <SectionTitle
        action={canVerify ? (
          <span className="flex gap-2">
            <LinkButton href={`/api/export/federal?${exportQs}`} variant="secondary" size="sm" className="h-11"><Download className="h-4 w-4" aria-hidden /> CSV</LinkButton>
            <LinkButton href={`/federal/print?${exportQs}`} target="_blank" variant="secondary" size="sm" className="h-11"><Printer className="h-4 w-4" aria-hidden /> Drucken</LinkButton>
          </span>
        ) : undefined}
      >
        Amtliche Resultate
      </SectionTitle>
      <form method="get" className="animate-rise mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <input type="hidden" name="year" value={year} />
        <Select name="kind" defaultValue={kindFilter} aria-label="Art" className="h-11">
          <option value="">Alle Arten</option>
          {OFFICIAL_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </Select>
        <Select name="status" defaultValue={statusFilter} aria-label="Status" className="h-11">
          <option value="">Alle</option>
          <option value="passed">Bestanden</option>
          <option value="failed">Nicht bestanden</option>
          <option value="none">Ohne Regel</option>
        </Select>
        <Select name="eventId" defaultValue={eventFilter} aria-label="Anlass" className="h-11">
          <option value="">Alle Anlässe</option>
          {events.map((e) => <option key={e.id} value={e.id}>{formatDateZurich(e.startsAt, { weekday: undefined })} · {e.title}</option>)}
        </Select>
        <Input name="q" defaultValue={q} placeholder="Name suchen" aria-label="Name suchen" className="h-11" />
        <Button type="submit" variant="secondary" className="col-span-2 h-11 sm:col-span-1">Filtern</Button>
      </form>
      {shown.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {shown.map((r) => <ResultItem key={r.id} r={r} showName t={t} />)}
        </Card>
      ) : (
        <EmptyState icon={<BadgeCheck className="h-5 w-5" />} title="Keine amtlichen Resultate" text="Resultate erscheinen hier, sobald der Schützenmeister sie im Durchgang amtlich bestätigt." />
      )}
      {filtered.length > shown.length ? <p className="mt-2 text-xs text-ink-3">Es werden die ersten {shown.length} von {filtered.length} Resultaten angezeigt. Für alle: CSV-Export.</p> : null}
      {canVerify ? <p className="mt-2 text-xs text-ink-3">Export für SAT-Admin ohne AHV-Nummer (wird in der App nicht gespeichert). Auf der Druckliste ist eine leere Spalte zum Ergänzen vorgesehen.</p> : null}

      {mine}

      <Alert tone="info" className="mt-6">{FEDERAL_RESPONSIBILITY_HINT} Feldschiessen-Auszeichnungen werden mit den vom Verein erfassten Limiten berechnet (Limiten gemäss Ausschreibung eintragen).</Alert>
    </div>
  );
}
