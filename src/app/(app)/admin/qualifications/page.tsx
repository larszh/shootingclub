import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Search, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, LinkTabs, PageHeader, Select, StatCard } from "@/components/ui";
import { requireTenant } from "@/lib/tenant";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/core";
import { listQualifications, qualificationCounts, type QualificationRow } from "@/modules/qualifications/queries";
import { isQualificationKind, QUALIFICATION_KINDS, qualificationLabel } from "@/modules/qualifications/types";
import { shiftMemberOptions } from "@/modules/shifts/queries";
import { ShiftAdminTabs } from "@/modules/shifts/ui/nav";
import { DeleteQualificationButton, QualificationButton } from "@/modules/qualifications/ui/qualification-dialog";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.qual.title") };
}
const dayKey = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function QualificationsPage({ searchParams }: { searchParams: Promise<{ kind?: string; filter?: string; q?: string }> }) {
  const ctx = await requireTenant();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const dayFmt = (d: Date) => formatDate(d, locale, { timeZone: "UTC" });
  const canManage = ctx.can("qualifications.manage");
  if (!canManage && !ctx.can("members.view")) redirect("/?denied=1");
  const sp = await searchParams;
  const kind = sp.kind && isQualificationKind(sp.kind) ? sp.kind : undefined;
  const expiring = sp.filter === "expiring";
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const tenantId = ctx.tenant.id;
  const [rows, counts, members] = await Promise.all([
    listQualifications(tenantId, { kind, expiring, q }),
    qualificationCounts(tenantId),
    canManage ? shiftMemberOptions(tenantId) : Promise.resolve([]),
  ]);
  const memberChoices = members.map((m) => ({ userId: m.userId, name: m.name }));
  const qs = (f: string | null) => {
    const p = new URLSearchParams();
    if (kind) p.set("kind", kind);
    if (q) p.set("q", q);
    if (f) p.set("filter", f);
    return `/admin/qualifications${p.size ? `?${p}` : ""}`;
  };
  const byUser = new Map<string, { name: string; items: QualificationRow[] }>();
  for (const r of rows) {
    const g = byUser.get(r.userId) ?? { name: r.user.name, items: [] };
    g.items.push(r);
    byUser.set(r.userId, g);
  }
  const showShiftTabs = ctx.hasModule("shifts") && ctx.can("shifts.manage");

  return (
    <div>
      {showShiftTabs ? <ShiftAdminTabs /> : null}
      <PageHeader title={t("adm2.qual.title")} subtitle={t("adm2.qual.subtitle")} back={showShiftTabs ? undefined : { href: "/admin", label: t("adm2.common.settings") }}
        action={canManage ? <QualificationButton members={memberChoices} /> : undefined} />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label={t("adm2.qual.stat.total")} value={counts.total} />
        <StatCard label={t("adm2.qual.stat.expiring")} value={counts.expiring} tone={counts.expiring ? "warn" : "neutral"} href={qs("expiring")} />
        <StatCard label={t("adm2.qual.stat.expired")} value={counts.expired} tone={counts.expired ? "warn" : "neutral"} href={qs("expiring")} />
      </div>

      <LinkTabs active={expiring ? "expiring" : "all"} label={t("adm2.qual.filter")} className="mb-3" items={[{ value: "all", label: t("adm2.common.all"), href: qs(null) }, { value: "expiring", label: t("adm2.qual.filter.expiring"), href: qs("expiring") }]} />
      <form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
        {expiring ? <input type="hidden" name="filter" value="expiring" /> : null}
        <Select name="kind" defaultValue={kind ?? ""} aria-label={t("adm2.qual.kind")} className="sm:w-56">
          <option value="">{t("adm2.qual.allKinds")}</option>
          {QUALIFICATION_KINDS.map((k) => <option key={k.key} value={k.key}>{qualificationLabel(k.key, t)}</option>)}
        </Select>
        <Input name="q" defaultValue={q ?? ""} placeholder={t("adm2.qual.searchName")} aria-label={t("adm2.qual.searchName")} className="sm:flex-1" />
        <Button type="submit" variant="secondary"><Search className="h-4 w-4" /> {t("adm2.common.filter")}</Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title={counts.total ? t("adm2.qual.nothing") : t("adm2.qual.none")}
          text={counts.total ? t("adm2.qual.adjustFilter") : t("adm2.qual.emptyText")} />
      ) : (
        <div className="space-y-3">
          {[...byUser].map(([userId, g]) => (
            <Card key={userId} className="animate-rise overflow-hidden">
              <div className="border-b border-line px-4 py-2.5 font-semibold">{g.name}</div>
              <div className="divide-y divide-line">
                {g.items.map((r) => (
                  <div key={r.id} className="flex min-h-14 items-center gap-2 px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{qualificationLabel(r.kind, t)}</span>
                        {r.label ? <span className="text-ink-2">· {r.label}</span> : null}
                        {r.state === "expired" ? <Badge tone="danger">{t("adm2.qual.expired")}</Badge> : r.state === "expiring" ? <Badge tone="warn">{t("adm2.qual.expiring")}{r.daysLeft !== null ? t("adm2.qual.inDays", { n: r.daysLeft }) : ""}</Badge> : r.state === "future" ? <Badge tone="outline">{t("adm2.qual.future")}</Badge> : null}
                      </div>
                      <div className="text-xs text-ink-3">
                        {[r.number ? t("adm2.qual.nr", { n: r.number }) : null, r.validFrom ? t("adm2.qual.from", { date: dayFmt(r.validFrom) }) : null, r.validUntil ? t("adm2.qual.until", { date: dayFmt(r.validUntil) }) : t("adm2.qual.unlimited"), r.verifiedByName ? t("adm2.qual.verified", { name: r.verifiedByName }) : null, r.sourceParticipantId ? t("adm2.qual.fromShooting") : null, r.note].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0">
                        <QualificationButton members={memberChoices.some((m) => m.userId === r.userId) ? memberChoices : [...memberChoices, { userId: r.userId, name: r.user.name }]}
                          initial={{ id: r.id, userId: r.userId, kind: r.kind, label: r.label, number: r.number, validFrom: dayKey(r.validFrom), validUntil: dayKey(r.validUntil), note: r.note }} />
                        <DeleteQualificationButton id={r.id} label={t("adm2.qual.labelOf", { kind: qualificationLabel(r.kind, t), name: r.user.name })} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-ink-3">{t("adm2.qual.footer")}</p>
    </div>
  );
}
