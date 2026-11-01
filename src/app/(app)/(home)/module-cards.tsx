import "server-only";
import Link from "next/link";
import { BadgeCheck, ChevronRight, DoorOpen, HandHelping, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import type { AppContext, ActiveTenant } from "@/lib/tenant";
import { zurichParts } from "@/lib/time";
import { INTL_LOCALE, formatDate, getT, type Locale, type TFunction } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Card, SectionTitle } from "@/components/ui";
import { todayDbDate } from "@/modules/range/queries";
import { nowDate } from "@/modules/billing/dates";
import { yearRange } from "@/modules/federal/queries";
import { opStatusByUser } from "@/modules/federal/types";
import { getChampionship, loadRanking } from "@/modules/championship/queries";

type TenantCtx = AppContext & { tenant: ActiveTenant };
/** Sprache und Übersetzer für die Karten */
type L = { t: TFunction; locale: Locale };

function timeRange(start: Date, end: Date, locale: Locale) {
  const f = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit" });
  return `${f.format(start)}–${f.format(end)}`;
}
type Tone = "ok" | "warn" | "danger" | "neutral";
type ModuleCard = { key: string; href: string; icon: React.ComponentType<{ className?: string }>; title: string; value: string; hint?: string; tone: Tone };

/*
 * Kompakte Status-Karten der Welle-B-Module auf der Startseite. Jede Karte macht genau eine kleine
 * Abfrage (die Meisterschaft zusätzlich die Rangliste der laufenden Saison) und erscheint nur, wenn
 * das Modul aktiv ist. Fehler blenden die Karte aus, statt die Startseite zu stören.
 */

/** Stand heute offen/geschlossen (Standbuch des heutigen Tages). */
async function rangeCard(ctx: TenantCtx, { t }: L): Promise<ModuleCard | null> {
  const days = await db.rangeDay.findMany({
    where: { tenantId: ctx.tenant.id, closedAt: null, date: todayDbDate() },
    select: { dutyName: true, resource: { select: { name: true } }, _count: { select: { visits: { where: { checkedOutAt: null } } } } },
    take: 5,
  });
  if (!days.length) {
    return { key: "range", href: "/range", icon: DoorOpen, title: t("shell.home.cards.rangeToday"), value: t("shell.home.cards.closed"), hint: t("shell.home.cards.noRangeDay"), tone: "neutral" };
  }
  const people = days.reduce((a, d) => a + d._count.visits, 0);
  const duty = days.map((d) => d.dutyName).filter(Boolean)[0];
  const where = days.length === 1 ? (days[0]!.resource?.name ?? t("shell.home.cards.wholeRange")) : t("shell.home.cards.ranges", { count: days.length });
  return {
    key: "range",
    href: "/range",
    icon: DoorOpen,
    title: t("shell.home.cards.rangeToday"),
    value: t("shell.home.cards.open"),
    hint: [where, t(people === 1 ? "shell.home.cards.peopleOne" : "shell.home.cards.peopleMany", { count: people }), duty ? t("shell.home.cards.duty", { name: duty }) : null].filter(Boolean).join(" · "),
    tone: "ok",
  };
}

/** Meine nächste Schicht (eingeteilt, noch nicht vorbei). */
async function shiftCard(ctx: TenantCtx, { t, locale }: L): Promise<ModuleCard | null> {
  const a = await db.shiftAssignment.findFirst({
    where: { userId: ctx.user.id, status: "ASSIGNED", shift: { tenantId: ctx.tenant.id, endsAt: { gte: nowDate() } } },
    orderBy: { shift: { startsAt: "asc" } },
    select: { shift: { select: { title: true, startsAt: true, endsAt: true } } },
  });
  if (!a) return { key: "shifts", href: "/shifts", icon: HandHelping, title: t("shell.home.cards.nextShift"), value: t("shell.home.cards.noneShift"), hint: t("shell.home.cards.openShifts"), tone: "neutral" };
  return {
    key: "shifts",
    href: "/shifts?tab=mine",
    icon: HandHelping,
    title: t("shell.home.cards.nextShift"),
    value: formatDate(a.shift.startsAt, locale, { weekday: "short" }),
    hint: `${timeRange(a.shift.startsAt, a.shift.endsAt, locale)} · ${a.shift.title}`,
    tone: "neutral",
  };
}

/** Eigener Stand im Obligatorischen (amtlich bestätigte Resultate des laufenden Jahres). */
async function federalCard(ctx: TenantCtx, { t, locale }: L): Promise<ModuleCard | null> {
  const year = Number(zurichParts(nowDate()).dateStr.slice(0, 4));
  const { from, to } = yearRange(year);
  const rows = await db.matchParticipant.findMany({
    where: { userId: ctx.user.id, isOfficial: true, match: { tenantId: ctx.tenant.id, date: { gte: from, lt: to }, program: { officialKind: "OP" } } },
    select: { userId: true, passed: true, attempt: true, match: { select: { date: true } } },
    take: 20,
  });
  const st = opStatusByUser(rows.map((r) => ({ userId: r.userId, passed: r.passed, attempt: r.attempt, date: r.match.date }))).get(ctx.user.id);
  const base = { key: "federal", href: "/federal", icon: BadgeCheck, title: t("shell.home.cards.op", { year }) };
  if (!st) return { ...base, value: t("shell.home.cards.opNone"), hint: t("shell.home.cards.opNoneHint"), tone: "neutral" };
  if (st.status === "passed") return { ...base, value: t("shell.home.cards.opPassed"), hint: t("shell.home.cards.opPassedHint", { date: formatDate(st.lastDate, locale) }), tone: "ok" };
  if (st.status === "failed") return { ...base, value: t("shell.home.cards.opOpen"), hint: t(st.attempts === 1 ? "shell.home.cards.opAttemptOne" : "shell.home.cards.opAttemptMany", { count: st.attempts }), tone: "warn" };
  return { ...base, value: t("shell.home.cards.opRecorded"), hint: t("shell.home.cards.opRecordedHint"), tone: "neutral" };
}

/** Mein Rang in der veröffentlichten Jahresmeisterschaft des laufenden Jahres. */
async function championshipCard(ctx: TenantCtx, { t }: L): Promise<ModuleCard | null> {
  const year = Number(zurichParts(nowDate()).dateStr.slice(0, 4));
  const row = await db.championship.findFirst({
    where: { tenantId: ctx.tenant.id, isPublished: true, year },
    orderBy: { startsOn: "desc" },
    select: { id: true },
  });
  if (!row) return null;
  const c = await getChampionship(ctx.tenant.id, row.id);
  if (!c) return null;
  const { ranking } = await loadRanking(ctx.tenant.id, c);
  const me = ranking.ranked.find((e) => e.userId === ctx.user.id) ?? ranking.unclassified.find((e) => e.userId === ctx.user.id);
  const base = { key: "championship", href: `/championship/${c.id}`, icon: Trophy, title: c.name };
  if (!me) return { ...base, value: t("shell.home.cards.chNone"), hint: t("shell.home.cards.chRanked", { count: ranking.ranked.length }), tone: "neutral" };
  if (me.rank === null) return { ...base, value: t("shell.home.cards.chUnranked"), hint: me.missingRequired.length ? t("shell.home.cards.chMissing", { list: me.missingRequired.join(", ") }) : undefined, tone: "warn" };
  return { ...base, value: t("shell.home.cards.chRank", { rank: me.rank }), hint: t("shell.home.cards.chOf", { count: ranking.ranked.length, category: me.category }), tone: me.rank <= 3 ? "ok" : "neutral" };
}

async function safe(fn: () => Promise<ModuleCard | null>): Promise<ModuleCard | null> {
  try {
    return await fn();
  } catch (err) {
    console.error("[home] Modulkarte", err);
    return null;
  }
}

async function loadModuleCards(ctx: TenantCtx, l: L): Promise<ModuleCard[]> {
  const cards = await Promise.all([
    ctx.hasModule("range") ? safe(() => rangeCard(ctx, l)) : null,
    ctx.hasModule("shifts") ? safe(() => shiftCard(ctx, l)) : null,
    ctx.hasModule("federal") ? safe(() => federalCard(ctx, l)) : null,
    ctx.hasModule("championship") ? safe(() => championshipCard(ctx, l)) : null,
  ]);
  return cards.filter((c): c is ModuleCard => !!c);
}

const TONE: Record<Tone, string> = {
  ok: "bg-ok/12 text-ok",
  warn: "bg-warn/15 text-warn",
  danger: "bg-danger/12 text-danger",
  neutral: "bg-accent-soft text-accent",
};

export async function ModuleStatusCards({ ctx, locale }: { ctx: TenantCtx; locale: Locale }) {
  const t = getT(locale);
  const cards = await loadModuleCards(ctx, { t, locale });
  if (!cards.length) return null;
  return (
    <>
      <SectionTitle>{t("shell.home.cards.title")}</SectionTitle>
      <div className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.key} href={c.href} className="press block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <Card className="flex h-full min-h-16 items-center gap-3 p-4 transition-colors hover:border-ink/30">
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", TONE[c.tone])}>
                <c.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-ink-3">{c.title}</div>
                <div className="truncate font-semibold">{c.value}</div>
                {c.hint ? <div className="truncate text-xs text-ink-3">{c.hint}</div> : null}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
