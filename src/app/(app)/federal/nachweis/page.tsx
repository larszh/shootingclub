import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarCheck, Printer } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, LinkButton, PageHeader, SectionTitle, Select } from "@/components/ui";
import { currentMembers, getNachweisMember, nowDate, requireFederal } from "@/modules/federal/queries";
import { shootingDaysForUser } from "@/modules/federal/service";
import { formatDay, formatDbDate, groupDaysByYear, nachweisRange } from "@/modules/federal/types";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.nachweis.title") };
}

export default async function NachweisPage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const ctx = await requireFederal();
  const t = getT(await getRequestLocale());
  const sp = await searchParams;
  const isAdmin = ctx.can("members.view");
  const targetId = isAdmin && sp.userId ? sp.userId.slice(0, 64) : ctx.user.id;
  const member = await getNachweisMember(ctx.tenant.id, targetId);
  if (!member) {
    if (targetId !== ctx.user.id) notFound();
  }
  const { from, to, fromDay, today } = nachweisRange(nowDate());
  const [days, members] = await Promise.all([
    shootingDaysForUser(ctx.tenant.id, targetId, from, to),
    isAdmin ? currentMembers(ctx.tenant.id) : Promise.resolve([]),
  ]);
  const groups = groupDaysByYear(days);
  const isSelf = targetId === ctx.user.id;
  const printHref = `/federal/nachweis/print${isSelf ? "" : `?userId=${encodeURIComponent(targetId)}`}`;

  return (
    <div>
      <PageHeader
        title={t("shooting.nachweis.title")}
        subtitle={`${member?.name ?? ctx.user.name} · ${t("shooting.nachweis.range", { from: formatDay(fromDay), to: formatDay(today) })}`}
        back={{ href: "/federal", label: t("shooting.nachweis.back") }}
        action={<LinkButton href={printHref} target="_blank" variant="secondary" size="sm" className="h-11"><Printer className="h-4 w-4" aria-hidden /> {t("shooting.nachweis.print")}</LinkButton>}
      />

      {isAdmin ? (
        <form method="get" className="animate-rise mb-4 flex gap-2">
          <Select name="userId" defaultValue={targetId} aria-label={t("shooting.nachweis.chooseMember")} className="h-11 flex-1">
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
          </Select>
          <Button type="submit" variant="secondary" className="h-11">{t("shooting.nachweis.show")}</Button>
        </form>
      ) : null}

      <Alert tone="info" className="mb-4">
        {t("shooting.nachweis.info")}
      </Alert>

      <Card className="animate-rise p-4 space-y-1 text-sm">
        <div className="flex justify-between gap-3"><span className="text-ink-3">{t("shooting.nachweis.memberSince")}</span><span className="font-medium">{member?.joinedAt ? formatDbDate(member.joinedAt) : t("shooting.nachweis.notRecorded")}</span></div>
        {member?.leftAt ? <div className="flex justify-between gap-3"><span className="text-ink-3">{t("shooting.nachweis.left")}</span><span className="font-medium">{formatDbDate(member.leftAt)}</span></div> : null}
        <div className="flex justify-between gap-3"><span className="text-ink-3">{t("shooting.nachweis.days5y")}</span><span className="font-medium tabular-nums">{days.length}</span></div>
        {!member?.joinedAt && isAdmin ? <p className="pt-2 text-xs text-ink-3">{t("shooting.nachweis.addJoinDate")}</p> : null}
      </Card>

      {groups.length ? (
        groups.map((g) => (
          <div key={g.year}>
            <SectionTitle action={<Badge tone="outline">{t(g.days.length === 1 ? "shooting.nachweis.days.one" : "shooting.nachweis.days.other", { n: g.days.length })}</Badge>}>{g.year}</SectionTitle>
            <Card className="animate-rise divide-y divide-line overflow-hidden">
              {g.days.map((d) => (
                <div key={d.date.toISOString()} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="tabular-nums">{formatDbDate(d.date)}</span>
                  <span className="text-xs text-ink-3">{d.source === "match" ? t("shooting.nachweis.sourceMatch") : t("shooting.nachweis.sourceLog")}</span>
                </div>
              ))}
            </Card>
          </div>
        ))
      ) : (
        <EmptyState className="mt-4" icon={<CalendarCheck className="h-5 w-5" />} title={t("shooting.nachweis.none")} text={t("shooting.nachweis.noneText")} />
      )}
    </div>
  );
}
