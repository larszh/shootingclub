import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, ChevronRight, Plus, Printer } from "lucide-react";
import { Badge, Card, EmptyState, LinkButton, LinkTabs, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireQualificationAccess } from "@/modules/courses/guard";
import { dbDay } from "@/modules/courses/logic";
import { getRequestLocale, getT } from "@/lib/i18n";
import type { Locale, TFunction } from "@/lib/i18n/core";
import { dayKeyLabel } from "@/lib/i18n/extra/admin2/msg";
import { listHolders, listRules, type HolderItem } from "@/modules/courses/queries";
import { monthsLabel } from "@/modules/courses/types";
import { qualificationLabel, qualificationState, type QualificationState } from "@/modules/qualifications/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.courses.q.title") };
}

const STATE_TONE: Record<QualificationState, "ok" | "warn" | "danger" | "outline"> = { valid: "ok", expiring: "warn", expired: "danger", future: "outline" };

export default async function QualificationsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const ctx = await requireQualificationAccess();
  const locale = await getRequestLocale();
  const t = getT(locale);
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
        title={t("adm2.courses.q.title")}
        subtitle={t("adm2.courses.q.subtitle")}
        back={{ href: "/courses", label: t("adm2.courses.title") }}
        action={<LinkButton href="/courses/qualifications/new" size="md"><Plus className="h-4 w-4" /> {t("adm2.courses.q.rule")}</LinkButton>}
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label={t("adm2.courses.q.stat.valid")} value={current.filter((h) => h.st.state === "valid").length} tone="ok" />
        <StatCard label={t("adm2.courses.q.stat.expiring")} value={current.filter((h) => h.st.state === "expiring").length} tone={attention.length ? "warn" : "neutral"} href="/courses/qualifications?show=attention" />
        <StatCard label={t("adm2.courses.q.stat.expired")} value={current.filter((h) => h.st.state === "expired").length} tone={current.some((h) => h.st.state === "expired") ? "warn" : "neutral"} href="/courses/qualifications?show=attention" />
      </div>

      <SectionTitle>{t("adm2.courses.q.rules")}</SectionTitle>
      {rules.length === 0 ? (
        <EmptyState
          icon={<BadgeCheck className="h-5 w-5" />}
          title={t("adm2.courses.q.noRules")}
          text={t("adm2.courses.q.noRulesText")}
          action={<LinkButton href="/courses/qualifications/new"><Plus className="h-4 w-4" /> {t("adm2.courses.rule.create")}</LinkButton>}
        />
      ) : (
        <Card className="mb-6 divide-y divide-line overflow-hidden">
          {rules.map((r) => (
            <Link key={r.id} href={`/courses/qualifications/${r.id}`} className={`flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2 ${r.isActive ? "" : "opacity-60"}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  <Badge tone="accent">{qualificationLabel(r.kind, t)}</Badge>
                  {!r.isActive ? <Badge tone="outline">{t("adm2.courses.q.inactive")}</Badge> : null}
                </div>
                <div className="text-xs text-ink-3">
                  {t("adm2.courses.q.ruleRow", { program: r.program.name, score: r.passScore })}{r.maxZeros != null ? t("adm2.courses.q.ruleRowZeros", { n: r.maxZeros }) : ""}{t("adm2.courses.q.ruleRowValid", { months: monthsLabel(r.validityMonths, t) })}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
            </Link>
          ))}
        </Card>
      )}

      <SectionTitle>{t("adm2.courses.q.holders")}</SectionTitle>
      <LinkTabs
        className="mb-3"
        active={show}
        items={[
          { value: "all", label: t("adm2.common.all"), href: "/courses/qualifications", count: current.length },
          { value: "attention", label: t("adm2.courses.q.attention"), href: "/courses/qualifications?show=attention", count: attention.length },
        ]}
      />
      {list.length === 0 ? (
        <p className="text-sm text-ink-3">{show === "attention" ? t("adm2.courses.q.nothingSoon") : t("adm2.courses.q.noneGranted")}</p>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {list.map((h) => <HolderRow key={h.id} h={h} st={h.st.state} daysLeft={h.st.daysLeft} t={t} locale={locale} />)}
        </Card>
      )}
      <p className="mt-4 text-xs text-ink-3">{t("adm2.courses.qualResponsibility")}</p>
    </div>
  );
}

function HolderRow({ h, st, daysLeft, t, locale }: { h: HolderItem; st: QualificationState; daysLeft: number | null; t: TFunction; locale: Locale }) {
  const s = { label: t(`adm2.courses.q.state.${st}`), tone: STATE_TONE[st] };
  const until = dbDay(h.validUntil);
  const hint = st === "expiring" && daysLeft !== null ? t(daysLeft === 1 ? "adm2.courses.q.daysLeft.one" : "adm2.courses.q.daysLeft.other", { n: daysLeft }) : st === "expired" && daysLeft !== null ? t(-daysLeft === 1 ? "adm2.courses.q.daysAgo.one" : "adm2.courses.q.daysAgo.other", { n: -daysLeft }) : null;
  return (
    <div className="flex min-h-16 items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{h.user.name}</span>
          <Badge tone={s.tone}>{st === "expired" || st === "expiring" ? <AlertTriangle className="mr-1 h-3 w-3" /> : null}{s.label}</Badge>
        </div>
        <div className="text-xs text-ink-3">
          {h.label ?? qualificationLabel(h.kind, t)} · {until ? t("adm2.courses.q.validUntil", { date: dayKeyLabel(until, locale) }) : t("adm2.courses.q.unlimited")}{hint ? ` (${hint})` : ""}{h.verifiedByName ? t("adm2.courses.q.grantedBy", { name: h.verifiedByName }) : ""}
        </div>
      </div>
      <LinkButton href={`/courses/qualifications/certificate/${h.id}`} variant="ghost" size="sm" className="h-11 w-11 shrink-0 px-0" aria-label={t("adm2.courses.q.printCert")} prefetch={false}>
        <Printer className="h-4 w-4" />
      </LinkButton>
    </div>
  );
}
