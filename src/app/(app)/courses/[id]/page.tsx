import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarCheck, ChevronRight, ClipboardList, Download, FileUp, IdCard, Pencil, Printer, ShieldAlert, Trash2, UserPlus } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { formatTimeRange, todayZurich, zurichParts } from "@/lib/time";
import type { Locale, TFunction } from "@/lib/i18n/core";
import { dayKeyLabel } from "@/lib/i18n/extra/admin2/msg";
import { deleteCourseAction, setCourseStatusAction } from "@/modules/courses/actions";
import { requireCourses } from "@/modules/courses/guard";
import { ageOn, courseReferenceDay } from "@/modules/courses/logic";
import { getCourse, type CourseDetail } from "@/modules/courses/queries";
import { courseKindLabel, courseKindText, courseStatusInfo, isCourseKind, participantStatusInfo } from "@/modules/courses/types";
import { MyCourseCard } from "@/modules/courses/ui/my-course";
import { NavActionButton } from "@/modules/courses/ui/nav-action-button";
import { formatDate, getRequestLocale, getT } from "@/lib/i18n";
import { timeRangeText, tOr } from "@/modules/scores/ui/labels";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.courses.course") };
}

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCourses();
  const { id } = await params;
  const course = await getCourse(ctx.tenant.id, id.slice(0, 40));
  if (!course) notFound();
  const canManage = ctx.can("courses.manage");

  if (!canManage) {
    const me = course.participants.find((p) => p.userId === ctx.user.id);
    if (!me) notFound();
    const locale = await getRequestLocale();
    const t = getT(locale);
    return (
      <div className="max-w-2xl">
        <PageHeader title={course.name} subtitle={tOr(t, `shooting.courses.kind.${course.kind}`, courseKindLabel(course.kind))} back={{ href: "/courses", label: t("shooting.courses.title") }} />
        <MyCourseCard course={course} me={me} link={false} locale={locale} />
        {course.sessions.length ? (
          <div className="mt-6">
            <SectionTitle>{t("shooting.courses.sessions")}</SectionTitle>
            <Card className="divide-y divide-line">
              {course.sessions.map((s) => {
                const v = course.attendanceIdx.get(`${s.id}|${me.id}`);
                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{s.title}</div>
                      <div className="text-xs text-ink-3">{formatDate(s.startsAt, locale, { weekday: "short" })}{s.endsAt ? `, ${timeRangeText(locale, s.startsAt, s.endsAt)}` : ""}</div>
                    </div>
                    {v === true ? <Badge tone="ok">{t("shooting.courses.present")}</Badge> : v === false ? <Badge tone="outline">{t("shooting.courses.absent")}</Badge> : null}
                  </div>
                );
              })}
            </Card>
          </div>
        ) : null}
      </div>
    );
  }

  const locale = await getRequestLocale();
  return <ManageView course={course} locale={locale} t={getT(locale)} />;
}

function ManageView({ course, locale, t }: { course: CourseDetail; locale: Locale; t: TFunction }) {
  const today = todayZurich();
  const st = courseStatusInfo(course.status, t);
  const refDay = courseReferenceDay(course.startsOnDay, today);
  const tooFew = course.minParticipants != null && course.activeCount < course.minParticipants;
  const active = course.participants.filter((p) => p.status !== "DROPPED");
  const allPassed = active.filter((p) => p.completion.allPassed).length;
  const completed = course.participants.filter((p) => p.status === "COMPLETED").length;
  const nextSession = course.sessions.find((s) => zurichParts(s.startsAt).dateStr >= today) ?? null;
  const dates = [dayKeyLabel(course.startsOnDay, locale), dayKeyLabel(course.endsOnDay, locale)].filter(Boolean).join(" – ");
  const base = `/courses/${course.id}`;

  return (
    <div>
      <PageHeader
        title={course.name}
        subtitle={[courseKindLabel(course.kind, t), dates || String(course.year), course.leaderName ? t("adm2.courses.d.leader", { name: course.leaderName }) : null].filter(Boolean).join(" · ")}
        back={{ href: `/courses${course.year !== Number(today.slice(0, 4)) ? `?year=${course.year}` : ""}`, label: t("adm2.courses.title") }}
        action={<LinkButton href={`${base}/edit`} variant="secondary" size="md"><Pencil className="h-4 w-4" /> {t("adm2.courses.d.edit")}</LinkButton>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={st.tone}>{st.label}</Badge>
        {course.status === "PLANNED" ? <ActionButton size="sm" variant="secondary" action={setCourseStatusAction.bind(null, course.id, "RUNNING")}>{t("adm2.courses.d.start")}</ActionButton> : null}
        {course.status === "RUNNING" ? (
          <ActionButton size="sm" variant="secondary" action={setCourseStatusAction.bind(null, course.id, "CLOSED")} confirm={{ title: t("adm2.courses.d.closeQ"), message: t("adm2.courses.d.closeText"), confirmLabel: t("adm2.courses.d.closeConfirm") }}>
            {t("adm2.courses.d.close")}
          </ActionButton>
        ) : null}
        {course.status === "CLOSED" ? <ActionButton size="sm" variant="ghost" action={setCourseStatusAction.bind(null, course.id, "RUNNING")}>{t("adm2.courses.d.reopen")}</ActionButton> : null}
      </div>

      {tooFew ? (
        <Alert tone="warn" className="mb-4" icon={<AlertTriangle className="h-4 w-4" />} title={t("adm2.courses.d.tooFew")}>
          {t("adm2.courses.d.tooFewText", { n: course.activeCount, min: course.minParticipants ?? 0 })}{course.kind === "JUNGSCHUETZEN" ? ` ${t("adm2.common.checkHint")}` : ""}
        </Alert>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("adm2.courses.d.participants")} value={course.activeCount} hint={course.minParticipants != null ? t("adm2.courses.d.min", { n: course.minParticipants }) : undefined} tone={tooFew ? "warn" : "neutral"} />
        <StatCard label={t("adm2.courses.d.sessions")} value={course.sessions.length} href={`${base}/sessions`} />
        <StatCard label={t("adm2.courses.d.requiredMet")} value={course.requiredPrograms.length ? `${allPassed}/${active.length}` : "–"} href={`${base}/results`} tone={active.length && allPassed === active.length ? "ok" : "neutral"} />
        <StatCard label={t("adm2.courses.d.completed")} value={completed} tone={completed ? "ok" : "neutral"} />
      </div>

      {nextSession ? (
        <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
          <CalendarCheck className="h-5 w-5 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{zurichParts(nextSession.startsAt).dateStr === today ? t("adm2.courses.d.today") : t("adm2.courses.d.next")}: {nextSession.title}</div>
            <div className="text-xs text-ink-3">{formatDate(nextSession.startsAt, locale, { weekday: "short" })}{nextSession.endsAt ? `, ${formatTimeRange(nextSession.startsAt, nextSession.endsAt)}` : ""}</div>
          </div>
          <LinkButton href={`${base}/sessions/${nextSession.id}`} size="lg" className="w-full sm:w-auto">{t("adm2.courses.d.takeAttendance")}</LinkButton>
        </Card>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <LinkButton href={`${base}/participants/new`}><UserPlus className="h-4 w-4" /> {t("adm2.courses.d.participants")}</LinkButton>
        <LinkButton href={`${base}/sessions`} variant="secondary"><CalendarCheck className="h-4 w-4" /> {t("adm2.courses.d.sessionsAttendance")}</LinkButton>
        <LinkButton href={`${base}/results`} variant="secondary"><ClipboardList className="h-4 w-4" /> {t("adm2.courses.d.results")}</LinkButton>
        <LinkButton href={`${base}/import`} variant="secondary"><FileUp className="h-4 w-4" /> {t("adm2.courses.d.csvImport")}</LinkButton>
        <LinkButton href={`${base}/print`} variant="ghost" prefetch={false}><Printer className="h-4 w-4" /> {t("adm2.courses.d.list")}</LinkButton>
        <LinkButton href={`${base}/certificate`} variant="ghost" prefetch={false}><IdCard className="h-4 w-4" /> {t("adm2.courses.d.certificates")}</LinkButton>
        <LinkButton href={`/api/export/courses?course=${course.id}&kind=attendance`} variant="ghost" prefetch={false}><Download className="h-4 w-4" /> {t("adm2.courses.d.attendanceCsv")}{course.kind === "JS" ? " (NDS)" : ""}</LinkButton>
        <LinkButton href={`/api/export/courses?course=${course.id}&kind=participants`} variant="ghost" prefetch={false}><Download className="h-4 w-4" /> {t("adm2.courses.d.participantsCsv")}</LinkButton>
      </div>

      <SectionTitle>{t("adm2.courses.d.participants")}</SectionTitle>
      {course.participants.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-5 w-5" />}
          title={t("adm2.courses.d.none")}
          text={t("adm2.courses.d.noneText")}
          action={<LinkButton href={`${base}/participants/new`}><UserPlus className="h-4 w-4" /> {t("adm2.courses.d.add")}</LinkButton>}
        />
      ) : (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {course.participants.map((p) => {
            const ps = participantStatusInfo(p.status, t);
            const age = ageOn(p.birthDay, refDay);
            const missingGuardian = age !== null && age < 18 && !p.guardianName;
            return (
              <Link key={p.id} href={`${base}/participants/${p.id}`} className={`flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2 ${p.status === "DROPPED" ? "opacity-60" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.lastName} {p.firstName}</span>
                    <Badge tone={ps.tone}>{ps.label}</Badge>
                    {age !== null && age < 18 ? <Badge tone="warn">{t("adm2.courses.d.ageShort", { n: age })}</Badge> : null}
                    {missingGuardian ? <Badge tone="danger"><ShieldAlert className="mr-1 h-3 w-3" /> {t("adm2.courses.d.guardianMissing")}</Badge> : null}
                    {!p.userId ? <Badge tone="outline">{t("adm2.courses.d.external")}</Badge> : null}
                  </div>
                  <div className="text-xs text-ink-3">
                    {t("adm2.courses.d.attendanceRow", { n: p.attendance.present, total: p.attendance.total })}
                    {course.requiredPrograms.length ? t("adm2.courses.d.programsRow", { n: p.completion.passedCount, total: p.completion.required }) : ""}
                    {p.weapon ? ` · ${p.weapon.name}` : ""}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
              </Link>
            );
          })}
        </Card>
      )}

      {course.requiredPrograms.length ? (
        <p className="mt-3 text-sm text-ink-3">{t("adm2.courses.d.requiredList", { list: course.requiredPrograms.map((p) => p.name).join(", ") })}</p>
      ) : null}
      {course.notes ? (
        <Card className="mt-4 whitespace-pre-line p-4 text-sm text-ink-2">{course.notes}</Card>
      ) : null}

      <div className="mt-6 rounded-card bg-surface-2 p-4 text-xs text-ink-3">
        {isCourseKind(course.kind) ? <p className="mb-1">{courseKindText(course.kind, t)}</p> : null}
        <p>{t("adm2.courses.responsibility")}</p>
      </div>

      <div className="mt-6 flex justify-end">
        <NavActionButton
          to="/courses"
          variant="ghost"
          action={deleteCourseAction.bind(null, course.id)}
          confirm={{ title: t("adm2.courses.d.deleteQ"), message: t("adm2.courses.d.deleteText"), tone: "danger", confirmLabel: t("adm2.common.delete") }}
        >
          <Trash2 className="h-4 w-4" /> {t("adm2.courses.d.delete")}
        </NavActionButton>
      </div>
    </div>
  );
}
