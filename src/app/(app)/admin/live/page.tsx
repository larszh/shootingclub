import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MonitorPlay } from "lucide-react";
import { Alert, Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDate, formatDateTime } from "@/lib/i18n/core";
import { dayKeyLabel } from "@/lib/i18n/extra/admin2/msg";
import type { TFunction, Locale } from "@/lib/i18n/core";
import { liveFormOptions, listLiveBoards, nowDate, requireLiveAdmin } from "@/modules/live/admin";
import { isExpired } from "@/modules/live/logic";
import { LiveBoardForm } from "@/modules/live/ui/board-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.live.title") };
}

export default async function LiveBoardsPage() {
  const ctx = await requireLiveAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const now = nowDate();
  const today = todayZurich();
  const [boards, options] = await Promise.all([listLiveBoards(ctx.tenant.id), liveFormOptions(ctx.tenant.id, now)]);
  const active = boards.filter((b) => !isExpired(b.expiresAt, now));
  const past = boards.filter((b) => isExpired(b.expiresAt, now));
  const events = options.events.map((e) => ({ id: e.id, title: e.title, label: `${formatDate(e.startsAt, locale, { weekday: "short" })} · ${e.title}` }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("adm2.live.title")} subtitle={t("adm2.live.subtitle")} back={{ href: "/admin", label: t("adm2.live.back") }} />
      {!ctx.hasModule("scores") ? <Alert tone="warn" className="mb-4">{t("adm2.live.scoresOff")}</Alert> : null}

      <Card className="mb-6 p-4">
        <h2 className="mb-1 font-semibold">{t("adm2.live.new")}</h2>
        <p className="mb-4 text-sm text-ink-3">{t("adm2.live.newText")}</p>
        <LiveBoardForm
          programs={options.programs}
          events={events}
          values={{ title: t("adm2.live.title"), programId: "", eventId: "", date: today, showDecimals: false, expiresAt: `${today}T23:59` }}
        />
      </Card>

      <SectionTitle>{t("adm2.live.active")}</SectionTitle>
      {active.length ? (
        <BoardList boards={active} now={now} t={t} locale={locale} />
      ) : (
        <EmptyState icon={<MonitorPlay className="h-5 w-5" />} title={t("adm2.live.noneActive")} text={t("adm2.live.noneActiveText")} />
      )}
      {past.length ? (
        <>
          <SectionTitle>{t("adm2.live.expiredSection")}</SectionTitle>
          <BoardList boards={past} now={now} t={t} locale={locale} />
        </>
      ) : null}
    </div>
  );
}

function BoardList({ boards, now, t, locale }: { boards: Awaited<ReturnType<typeof listLiveBoards>>; now: Date; t: TFunction; locale: Locale }) {
  return (
    <Card className="mb-4 divide-y divide-line overflow-hidden">
      {boards.map((b) => {
        const expired = isExpired(b.expiresAt, now);
        return (
          <Link key={b.id} href={`/admin/live/${b.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2"><MonitorPlay className="h-5 w-5" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{b.title}</span>
                {expired ? <Badge tone="outline">{t("adm2.live.expired")}</Badge> : <Badge tone="ok">{t("adm2.live.activeBadge")}</Badge>}
              </div>
              <div className="truncate text-xs text-ink-3">
                {[b.day ? dayKeyLabel(b.day, locale) : t("adm2.live.today"), b.programName ?? t("adm2.live.allPrograms"), b.eventTitle].filter(Boolean).join(" · ")}
              </div>
              {b.expiresAt ? <div className="text-xs text-ink-3">{t("adm2.live.until", { date: formatDateTime(b.expiresAt, locale) })}</div> : null}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          </Link>
        );
      })}
    </Card>
  );
}
