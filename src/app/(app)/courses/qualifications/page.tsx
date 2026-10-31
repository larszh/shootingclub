import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, ChevronRight, Plus, Printer } from "lucide-react";
import { Badge, Card, EmptyState, LinkButton, LinkTabs, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireQualificationAccess } from "@/modules/courses/guard";
import { chDate, dbDay } from "@/modules/courses/logic";
import { listHolders, listRules, type HolderItem } from "@/modules/courses/queries";
import { monthsLabel, QUAL_RESPONSIBILITY_HINT } from "@/modules/courses/types";
import { qualificationLabel, qualificationState, type QualificationState } from "@/modules/qualifications/types";

export const metadata: Metadata = { title: "Qualifikationsschiessen" };

const STATE: Record<QualificationState, { label: string; tone: "ok" | "warn" | "danger" | "outline" }> = {
  valid: { label: "gültig", tone: "ok" },
  expiring: { label: "läuft ab", tone: "warn" },
  expired: { label: "überfällig", tone: "danger" },
  future: { label: "ab später", tone: "outline" },
};

export default async function QualificationsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const ctx = await requireQualificationAccess();
  const sp = await searchParams;
  const tenantId = ctx.tenant.id;
  const rules = await listRules(tenantId);
  const kinds = [...new Set(rules.map((r) => r.kind))];
  const holders = await listHolders(tenantId, kinds.length ? kinds : ["WEAPON_QUAL"]);
  const today = todayZurich();
  const withState = holders.map((h) => ({ ...h, st: qualificationState(h, today) }));
  // Pro Person und Art zählt die zuletzt ablaufende Qualifikation (ältere sind ersetzt).
  const latest = new Map<string, (typeof withState)[number]>();
  for (const h of withState) {
    const key = `${h.user.id}|${h.kind}|${h.label ?? ""}`;
    const cur = latest.get(key);
    if (!cur || (dbDay(h.validUntil) ?? "9999") > (dbDay(cur.validUntil) ?? "9999")) latest.set(key, h);
  }
  const current = [...latest.values()].sort((a, b) => (dbDay(a.validUntil) ?? "9999").localeCompare(dbDay(b.validUntil) ?? "9999"));
  const attention = current.filter((h) => h.st.state === "expired" || h.st.state === "expiring");
  const show = sp.show === "attention" ? "attention" : "all";
  const list = show === "attention" ? attention : current;

  return (
    <div>
      <PageHeader
        title="Qualifikationsschiessen"
        subtitle="Regeln, Erteilung und Ablauf"
        back={{ href: "/courses", label: "Kurse" }}
        action={<LinkButton href="/courses/qualifications/new" size="md"><Plus className="h-4 w-4" /> Regel</LinkButton>}
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="Gültig" value={current.filter((h) => h.st.state === "valid").length} tone="ok" />
        <StatCard label="Läuft ab" value={current.filter((h) => h.st.state === "expiring").length} tone={attention.length ? "warn" : "neutral"} href="/courses/qualifications?show=attention" />
        <StatCard label="Überfällig" value={current.filter((h) => h.st.state === "expired").length} tone={current.some((h) => h.st.state === "expired") ? "warn" : "neutral"} href="/courses/qualifications?show=attention" />
      </div>

      <SectionTitle>Regeln</SectionTitle>
      {rules.length === 0 ? (
        <EmptyState
          icon={<BadgeCheck className="h-5 w-5" />}
          title="Noch keine Regeln"
          text="Eine Regel legt fest, mit welchem Programm und welcher Punktzahl eine Qualifikation erteilt werden kann und wie lange sie gilt."
          action={<LinkButton href="/courses/qualifications/new"><Plus className="h-4 w-4" /> Regel erstellen</LinkButton>}
        />
      ) : (
        <Card className="mb-6 divide-y divide-line overflow-hidden">
          {rules.map((r) => (
            <Link key={r.id} href={`/courses/qualifications/${r.id}`} className={`flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2 ${r.isActive ? "" : "opacity-60"}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  <Badge tone="accent">{qualificationLabel(r.kind)}</Badge>
                  {!r.isActive ? <Badge tone="outline">inaktiv</Badge> : null}
                </div>
                <div className="text-xs text-ink-3">
                  {r.program.name} · ab {r.passScore} Punkten{r.maxZeros != null ? `, max. ${r.maxZeros} Nuller` : ""} · {monthsLabel(r.validityMonths)} gültig
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
            </Link>
          ))}
        </Card>
      )}

      <SectionTitle>Inhaber:innen</SectionTitle>
      <LinkTabs
        className="mb-3"
        active={show}
        items={[
          { value: "all", label: "Alle", href: "/courses/qualifications", count: current.length },
          { value: "attention", label: "Überfällig / läuft ab", href: "/courses/qualifications?show=attention", count: attention.length },
        ]}
      />
      {list.length === 0 ? (
        <p className="text-sm text-ink-3">{show === "attention" ? "Nichts läuft in den nächsten Wochen ab." : "Noch keine Qualifikationen erteilt."}</p>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {list.map((h) => <HolderRow key={h.id} h={h} st={h.st.state} daysLeft={h.st.daysLeft} />)}
        </Card>
      )}
      <p className="mt-4 text-xs text-ink-3">{QUAL_RESPONSIBILITY_HINT}</p>
    </div>
  );
}

function HolderRow({ h, st, daysLeft }: { h: HolderItem; st: QualificationState; daysLeft: number | null }) {
  const s = STATE[st];
  const until = dbDay(h.validUntil);
  const hint = st === "expiring" && daysLeft !== null ? `noch ${daysLeft} ${daysLeft === 1 ? "Tag" : "Tage"}` : st === "expired" && daysLeft !== null ? `seit ${-daysLeft} ${-daysLeft === 1 ? "Tag" : "Tagen"}` : null;
  return (
    <div className="flex min-h-16 items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{h.user.name}</span>
          <Badge tone={s.tone}>{st === "expired" || st === "expiring" ? <AlertTriangle className="mr-1 h-3 w-3" /> : null}{s.label}</Badge>
        </div>
        <div className="text-xs text-ink-3">
          {h.label ?? qualificationLabel(h.kind)} · {until ? `gültig bis ${chDate(until)}` : "unbefristet"}{hint ? ` (${hint})` : ""}{h.verifiedByName ? ` · erteilt durch ${h.verifiedByName}` : ""}
        </div>
      </div>
      <LinkButton href={`/courses/qualifications/certificate/${h.id}`} variant="ghost" size="sm" className="h-11 w-11 shrink-0 px-0" aria-label="Nachweis drucken" prefetch={false}>
        <Printer className="h-4 w-4" />
      </LinkButton>
    </div>
  );
}
