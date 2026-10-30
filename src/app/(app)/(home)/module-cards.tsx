import "server-only";
import Link from "next/link";
import { BadgeCheck, ChevronRight, DoorOpen, HandHelping, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import type { AppContext, ActiveTenant } from "@/lib/tenant";
import { formatDateZurich, formatTimeRange, zurichParts } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Card, SectionTitle } from "@/components/ui";
import { todayDbDate } from "@/modules/range/queries";
import { nowDate } from "@/modules/billing/dates";
import { yearRange } from "@/modules/federal/queries";
import { opStatusByUser } from "@/modules/federal/types";
import { getChampionship, loadRanking } from "@/modules/championship/queries";

type TenantCtx = AppContext & { tenant: ActiveTenant };
type Tone = "ok" | "warn" | "danger" | "neutral";
type ModuleCard = { key: string; href: string; icon: React.ComponentType<{ className?: string }>; title: string; value: string; hint?: string; tone: Tone };

/*
 * Kompakte Status-Karten der Welle-B-Module auf der Startseite. Jede Karte macht genau eine kleine
 * Abfrage (die Meisterschaft zusätzlich die Rangliste der laufenden Saison) und erscheint nur, wenn
 * das Modul aktiv ist. Fehler blenden die Karte aus, statt die Startseite zu stören.
 */

/** Stand heute offen/geschlossen (Standbuch des heutigen Tages). */
async function rangeCard(ctx: TenantCtx): Promise<ModuleCard | null> {
  const days = await db.rangeDay.findMany({
    where: { tenantId: ctx.tenant.id, closedAt: null, date: todayDbDate() },
    select: { dutyName: true, resource: { select: { name: true } }, _count: { select: { visits: { where: { checkedOutAt: null } } } } },
    take: 5,
  });
  if (!days.length) {
    return { key: "range", href: "/range", icon: DoorOpen, title: "Stand heute", value: "geschlossen", hint: "Kein Standbuch geöffnet", tone: "neutral" };
  }
  const people = days.reduce((a, d) => a + d._count.visits, 0);
  const duty = days.map((d) => d.dutyName).filter(Boolean)[0];
  const where = days.length === 1 ? (days[0]!.resource?.name ?? "ganze Anlage") : `${days.length} Anlagen`;
  return {
    key: "range",
    href: "/range",
    icon: DoorOpen,
    title: "Stand heute",
    value: "offen",
    hint: [where, people === 1 ? "1 Person am Stand" : `${people} Personen am Stand`, duty ? `Standdienst: ${duty}` : null].filter(Boolean).join(" · "),
    tone: "ok",
  };
}

/** Meine nächste Schicht (eingeteilt, noch nicht vorbei). */
async function shiftCard(ctx: TenantCtx): Promise<ModuleCard | null> {
  const a = await db.shiftAssignment.findFirst({
    where: { userId: ctx.user.id, status: "ASSIGNED", shift: { tenantId: ctx.tenant.id, endsAt: { gte: nowDate() } } },
    orderBy: { shift: { startsAt: "asc" } },
    select: { shift: { select: { title: true, startsAt: true, endsAt: true } } },
  });
  if (!a) return { key: "shifts", href: "/shifts", icon: HandHelping, title: "Meine nächste Schicht", value: "keine geplant", hint: "Offene Einsätze ansehen", tone: "neutral" };
  return {
    key: "shifts",
    href: "/shifts?tab=mine",
    icon: HandHelping,
    title: "Meine nächste Schicht",
    value: formatDateZurich(a.shift.startsAt),
    hint: `${formatTimeRange(a.shift.startsAt, a.shift.endsAt)} · ${a.shift.title}`,
    tone: "neutral",
  };
}

/** Eigener Stand im Obligatorischen (amtlich bestätigte Resultate des laufenden Jahres). */
async function federalCard(ctx: TenantCtx): Promise<ModuleCard | null> {
  const year = Number(zurichParts(nowDate()).dateStr.slice(0, 4));
  const { from, to } = yearRange(year);
  const rows = await db.matchParticipant.findMany({
    where: { userId: ctx.user.id, isOfficial: true, match: { tenantId: ctx.tenant.id, date: { gte: from, lt: to }, program: { officialKind: "OP" } } },
    select: { userId: true, passed: true, attempt: true, match: { select: { date: true } } },
    take: 20,
  });
  const st = opStatusByUser(rows.map((r) => ({ userId: r.userId, passed: r.passed, attempt: r.attempt, date: r.match.date }))).get(ctx.user.id);
  const base = { key: "federal", href: "/federal", icon: BadgeCheck, title: `Obligatorisch ${year}` };
  if (!st) return { ...base, value: "kein Resultat erfasst", hint: "Noch kein amtliches Resultat in diesem Jahr", tone: "neutral" };
  if (st.status === "passed") return { ...base, value: "bestanden", hint: `Amtlich bestätigt am ${formatDateZurich(st.lastDate, { weekday: undefined })}`, tone: "ok" };
  if (st.status === "failed") return { ...base, value: "noch offen", hint: st.attempts === 1 ? "1 Versuch, noch nicht bestanden" : `${st.attempts} Versuche, noch nicht bestanden`, tone: "warn" };
  return { ...base, value: "erfasst", hint: "Amtliches Resultat bestätigt", tone: "neutral" };
}

/** Mein Rang in der veröffentlichten Jahresmeisterschaft des laufenden Jahres. */
async function championshipCard(ctx: TenantCtx): Promise<ModuleCard | null> {
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
  if (!me) return { ...base, value: "noch kein Resultat", hint: `${ranking.ranked.length} klassiert`, tone: "neutral" };
  if (me.rank === null) return { ...base, value: "nicht klassiert", hint: me.missingRequired.length ? `Fehlt: ${me.missingRequired.join(", ")}` : undefined, tone: "warn" };
  return { ...base, value: `Rang ${me.rank}`, hint: `von ${ranking.ranked.length} · ${me.category}`, tone: me.rank <= 3 ? "ok" : "neutral" };
}

async function safe(fn: () => Promise<ModuleCard | null>): Promise<ModuleCard | null> {
  try {
    return await fn();
  } catch (err) {
    console.error("[home] Modulkarte", err);
    return null;
  }
}

async function loadModuleCards(ctx: TenantCtx): Promise<ModuleCard[]> {
  const cards = await Promise.all([
    ctx.hasModule("range") ? safe(() => rangeCard(ctx)) : null,
    ctx.hasModule("shifts") ? safe(() => shiftCard(ctx)) : null,
    ctx.hasModule("federal") ? safe(() => federalCard(ctx)) : null,
    ctx.hasModule("championship") ? safe(() => championshipCard(ctx)) : null,
  ]);
  return cards.filter((c): c is ModuleCard => !!c);
}

const TONE: Record<Tone, string> = {
  ok: "bg-ok/12 text-ok",
  warn: "bg-warn/15 text-warn",
  danger: "bg-danger/12 text-danger",
  neutral: "bg-accent-soft text-accent",
};

export async function ModuleStatusCards({ ctx }: { ctx: TenantCtx }) {
  const cards = await loadModuleCards(ctx);
  if (!cards.length) return null;
  return (
    <>
      <SectionTitle>Im Verein</SectionTitle>
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
