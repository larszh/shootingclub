import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, ChevronRight, GraduationCap, Plus } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, LinkTabs, PageHeader, SectionTitle } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireCourses } from "@/modules/courses/guard";
import { dayKeyLabel } from "@/lib/i18n/extra/admin2/msg";
import type { Locale, TFunction } from "@/lib/i18n/core";
import { courseYears, listCourses, myCourseParticipations, type CourseListItem } from "@/modules/courses/queries";
import { COURSE_KINDS, courseKindShort, courseStatusInfo } from "@/modules/courses/types";
import { isCourseKind } from "@/modules/courses/types";
import { MyCourseCard } from "@/modules/courses/ui/my-course";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.courses.title") };
}

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ year?: string; kind?: string; denied?: string }> }) {
  const ctx = await requireCourses();
  const sp = await searchParams;
  const canManage = ctx.can("courses.manage");
  const canQual = canManage || ctx.can("qualifications.manage");
  const tenantId = ctx.tenant.id;
  const thisYear = Number(todayZurich().slice(0, 4));
  const mine = await myCourseParticipations(tenantId, ctx.user.id);

  const locale = await getRequestLocale();
  const t = getT(locale);

  if (!canManage) {
    return (
      <div>
        <PageHeader title={t("shooting.courses.title")} subtitle={t("shooting.courses.subtitleMine")} action={canQual ? <LinkButton href="/courses/qualifications" variant="secondary"><BadgeCheck className="h-4 w-4" /> {t("shooting.courses.qualifications")}</LinkButton> : undefined} />
        {sp.denied ? <Alert className="mb-4">{t("shooting.courses.deniedLeader")}</Alert> : null}
        {mine.length ? (
          <div className="space-y-3">{mine.map((m) => <MyCourseCard key={m.me.id} course={m.course} me={m.me} locale={locale} />)}</div>
        ) : (
          <EmptyState icon={<GraduationCap className="h-5 w-5" />} title={t("shooting.courses.none")} text={t("shooting.courses.noneText")} />
        )}
      </div>
    );
  }

  const years = [...new Set([thisYear + 1, thisYear, ...(await courseYears(tenantId))])].sort((a, b) => b - a);
  const year = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : thisYear;
  const kind = isCourseKind(sp.kind) ? sp.kind : undefined;
  const courses = await listCourses(tenantId, { year, kind });
  const qs = (y: number, k?: string) => {
    const p = new URLSearchParams();
    if (y !== thisYear) p.set("year", String(y));
    if (k) p.set("kind", k);
    return `/courses${p.size ? `?${p}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title={t("adm2.courses.title")}
        subtitle={t("adm2.courses.list.subtitle")}
        action={<LinkButton href="/courses/new" size="md"><Plus className="h-4 w-4" /> {t("adm2.courses.list.add")}</LinkButton>}
      />
      {sp.denied ? <Alert className="mb-4">{t("adm2.courses.list.denied")}</Alert> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <LinkButton href="/courses/qualifications" variant="secondary"><BadgeCheck className="h-4 w-4" /> {t("adm2.courses.list.qualShooting")}</LinkButton>
      </div>

      <LinkTabs label={t("adm2.courses.list.year")} className="mb-2" active={String(year)} items={years.map((y) => ({ value: String(y), label: String(y), href: qs(y, kind) }))} />
      <LinkTabs
        label={t("adm2.courses.list.kind")}
        className="mb-4"
        active={kind ?? "all"}
        items={[{ value: "all", label: t("adm2.common.all"), href: qs(year) }, ...COURSE_KINDS.map((k) => ({ value: k, label: courseKindShort(k, t), href: qs(year, k) }))]}
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-5 w-5" />}
          title={t("adm2.courses.list.none", { year })}
          text={t("adm2.courses.list.noneText")}
          action={<LinkButton href="/courses/new"><Plus className="h-4 w-4" /> {t("adm2.courses.form.create")}</LinkButton>}
        />
      ) : (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {courses.map((c) => <CourseRow key={c.id} c={c} t={t} locale={locale} />)}
        </Card>
      )}

      {mine.length ? (
        <div className="mt-6">
          <SectionTitle>{t("shooting.courses.myParticipations")}</SectionTitle>
          <div className="space-y-3">{mine.map((m) => <MyCourseCard key={m.me.id} course={m.course} me={m.me} locale={locale} />)}</div>
        </div>
      ) : null}
    </div>
  );
}

function CourseRow({ c, t, locale }: { c: CourseListItem; t: TFunction; locale: Locale }) {
  const st = courseStatusInfo(c.status, t);
  const tooFew = c.minParticipants != null && c.participants < c.minParticipants && c.status !== "CLOSED";
  const dates = [dayKeyLabel(c.startsOn, locale), dayKeyLabel(c.endsOn, locale)].filter(Boolean).join(" – ");
  return (
    <Link href={`/courses/${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{c.name}</span>
          <Badge tone="accent">{isCourseKind(c.kind) ? courseKindShort(c.kind, t) : c.kind}</Badge>
          <Badge tone={st.tone}>{st.label}</Badge>
          {tooFew ? <Badge tone="warn"><AlertTriangle className="mr-1 h-3 w-3" /> {t("adm2.courses.list.tooFew")}</Badge> : null}
        </div>
        <div className="truncate text-xs text-ink-3">
          {[dates, c.leaderName ? t("adm2.courses.d.leader", { name: c.leaderName }) : null].filter(Boolean).join(" · ") || t("adm2.courses.list.noDates")}
        </div>
        <div className="text-xs text-ink-3">
          {t("adm2.courses.list.participants", { n: c.participants })}{c.minParticipants != null ? t("adm2.courses.list.minN", { n: c.minParticipants }) : ""}{t("adm2.courses.list.sessions", { n: c.sessions })}
          {c.requiredCount ? t("adm2.courses.list.required", { n: c.requiredCount }) : ""}{c.completed ? t("adm2.courses.list.completed", { n: c.completed }) : ""}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
    </Link>
  );
}
