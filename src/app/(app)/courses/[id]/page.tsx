import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarCheck, ChevronRight, ClipboardList, Download, FileUp, IdCard, Pencil, Printer, ShieldAlert, Trash2, UserPlus } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { formatDateZurich, formatTimeRange, todayZurich, zurichParts } from "@/lib/time";
import { deleteCourseAction, setCourseStatusAction } from "@/modules/courses/actions";
import { requireCourses } from "@/modules/courses/guard";
import { ageOn, chDate, courseReferenceDay } from "@/modules/courses/logic";
import { getCourse, type CourseDetail } from "@/modules/courses/queries";
import { CHECK_HINT, COURSE_KIND, courseKindLabel, courseStatusInfo, isCourseKind, participantStatusInfo, RESPONSIBILITY_HINT } from "@/modules/courses/types";
import { MyCourseCard } from "@/modules/courses/ui/my-course";
import { NavActionButton } from "@/modules/courses/ui/nav-action-button";

export const metadata: Metadata = { title: "Kurs" };

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCourses();
  const { id } = await params;
  const course = await getCourse(ctx.tenant.id, id.slice(0, 40));
  if (!course) notFound();
  const canManage = ctx.can("courses.manage");

  if (!canManage) {
    const me = course.participants.find((p) => p.userId === ctx.user.id);
    if (!me) notFound();
    return (
      <div className="max-w-2xl">
        <PageHeader title={course.name} subtitle={courseKindLabel(course.kind)} back={{ href: "/courses", label: "Kurse" }} />
        <MyCourseCard course={course} me={me} link={false} />
        {course.sessions.length ? (
          <div className="mt-6">
            <SectionTitle>Lektionen</SectionTitle>
            <Card className="divide-y divide-line">
              {course.sessions.map((s) => {
                const v = course.attendanceIdx.get(`${s.id}|${me.id}`);
                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{s.title}</div>
                      <div className="text-xs text-ink-3">{formatDateZurich(s.startsAt)}{s.endsAt ? `, ${formatTimeRange(s.startsAt, s.endsAt)}` : ""}</div>
                    </div>
                    {v === true ? <Badge tone="ok">anwesend</Badge> : v === false ? <Badge tone="outline">abwesend</Badge> : null}
                  </div>
                );
              })}
            </Card>
          </div>
        ) : null}
      </div>
    );
  }

  return <ManageView course={course} />;
}

function ManageView({ course }: { course: CourseDetail }) {
  const today = todayZurich();
  const st = courseStatusInfo(course.status);
  const refDay = courseReferenceDay(course.startsOnDay, today);
  const tooFew = course.minParticipants != null && course.activeCount < course.minParticipants;
  const active = course.participants.filter((p) => p.status !== "DROPPED");
  const allPassed = active.filter((p) => p.completion.allPassed).length;
  const completed = course.participants.filter((p) => p.status === "COMPLETED").length;
  const nextSession = course.sessions.find((s) => zurichParts(s.startsAt).dateStr >= today) ?? null;
  const dates = [chDate(course.startsOnDay), chDate(course.endsOnDay)].filter(Boolean).join(" – ");
  const base = `/courses/${course.id}`;

  return (
    <div>
      <PageHeader
        title={course.name}
        subtitle={[courseKindLabel(course.kind), dates || String(course.year), course.leaderName ? `Leitung: ${course.leaderName}` : null].filter(Boolean).join(" · ")}
        back={{ href: `/courses${course.year !== Number(today.slice(0, 4)) ? `?year=${course.year}` : ""}`, label: "Kurse" }}
        action={<LinkButton href={`${base}/edit`} variant="secondary" size="md"><Pencil className="h-4 w-4" /> Bearbeiten</LinkButton>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={st.tone}>{st.label}</Badge>
        {course.status === "PLANNED" ? <ActionButton size="sm" variant="secondary" action={setCourseStatusAction.bind(null, course.id, "RUNNING")}>Kurs starten</ActionButton> : null}
        {course.status === "RUNNING" ? (
          <ActionButton size="sm" variant="secondary" action={setCourseStatusAction.bind(null, course.id, "CLOSED")} confirm={{ title: "Kurs abschliessen?", message: "Der Kurs erscheint danach als abgeschlossen. Du kannst ihn wieder öffnen.", confirmLabel: "Abschliessen" }}>
            Kurs abschliessen
          </ActionButton>
        ) : null}
        {course.status === "CLOSED" ? <ActionButton size="sm" variant="ghost" action={setCourseStatusAction.bind(null, course.id, "RUNNING")}>Wieder öffnen</ActionButton> : null}
      </div>

      {tooFew ? (
        <Alert tone="warn" className="mb-4" icon={<AlertTriangle className="h-4 w-4" />} title="Zu wenige Teilnehmende">
          Erst {course.activeCount} von mindestens {course.minParticipants} angemeldet.{course.kind === "JUNGSCHUETZEN" ? ` ${CHECK_HINT}` : ""}
        </Alert>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Teilnehmende" value={course.activeCount} hint={course.minParticipants != null ? `min. ${course.minParticipants}` : undefined} tone={tooFew ? "warn" : "neutral"} />
        <StatCard label="Lektionen" value={course.sessions.length} href={`${base}/sessions`} />
        <StatCard label="Pflichtprogramme erfüllt" value={course.requiredPrograms.length ? `${allPassed}/${active.length}` : "–"} href={`${base}/results`} tone={active.length && allPassed === active.length ? "ok" : "neutral"} />
        <StatCard label="Abgeschlossen" value={completed} tone={completed ? "ok" : "neutral"} />
      </div>

      {nextSession ? (
        <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
          <CalendarCheck className="h-5 w-5 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{zurichParts(nextSession.startsAt).dateStr === today ? "Heute" : "Nächste Lektion"}: {nextSession.title}</div>
            <div className="text-xs text-ink-3">{formatDateZurich(nextSession.startsAt)}{nextSession.endsAt ? `, ${formatTimeRange(nextSession.startsAt, nextSession.endsAt)}` : ""}</div>
          </div>
          <LinkButton href={`${base}/sessions/${nextSession.id}`} size="lg" className="w-full sm:w-auto">Präsenz erfassen</LinkButton>
        </Card>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <LinkButton href={`${base}/participants/new`}><UserPlus className="h-4 w-4" /> Teilnehmende</LinkButton>
        <LinkButton href={`${base}/sessions`} variant="secondary"><CalendarCheck className="h-4 w-4" /> Lektionen &amp; Präsenz</LinkButton>
        <LinkButton href={`${base}/results`} variant="secondary"><ClipboardList className="h-4 w-4" /> Resultate</LinkButton>
        <LinkButton href={`${base}/import`} variant="secondary"><FileUp className="h-4 w-4" /> CSV-Import</LinkButton>
        <LinkButton href={`${base}/print`} variant="ghost" prefetch={false}><Printer className="h-4 w-4" /> Teilnehmerliste</LinkButton>
        <LinkButton href={`${base}/certificate`} variant="ghost" prefetch={false}><IdCard className="h-4 w-4" /> Kursausweise</LinkButton>
        <LinkButton href={`/api/export/courses?course=${course.id}&kind=attendance`} variant="ghost" prefetch={false}><Download className="h-4 w-4" /> Präsenz CSV{course.kind === "JS" ? " (NDS)" : ""}</LinkButton>
        <LinkButton href={`/api/export/courses?course=${course.id}&kind=participants`} variant="ghost" prefetch={false}><Download className="h-4 w-4" /> Teilnehmende CSV</LinkButton>
      </div>

      <SectionTitle>Teilnehmende</SectionTitle>
      {course.participants.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-5 w-5" />}
          title="Noch keine Teilnehmenden"
          text="Mitglieder auswählen oder Jugendliche ohne Konto erfassen. Mehrere auf einmal per CSV-Import."
          action={<LinkButton href={`${base}/participants/new`}><UserPlus className="h-4 w-4" /> Hinzufügen</LinkButton>}
        />
      ) : (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {course.participants.map((p) => {
            const ps = participantStatusInfo(p.status);
            const age = ageOn(p.birthDay, refDay);
            const missingGuardian = age !== null && age < 18 && !p.guardianName;
            return (
              <Link key={p.id} href={`${base}/participants/${p.id}`} className={`flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2 ${p.status === "DROPPED" ? "opacity-60" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.lastName} {p.firstName}</span>
                    <Badge tone={ps.tone}>{ps.label}</Badge>
                    {age !== null && age < 18 ? <Badge tone="warn">{age} J.</Badge> : null}
                    {missingGuardian ? <Badge tone="danger"><ShieldAlert className="mr-1 h-3 w-3" /> Erziehungsberechtigte fehlen</Badge> : null}
                    {!p.userId ? <Badge tone="outline">extern</Badge> : null}
                  </div>
                  <div className="text-xs text-ink-3">
                    Präsenz {p.attendance.present}/{p.attendance.total}
                    {course.requiredPrograms.length ? ` · Programme ${p.completion.passedCount}/${p.completion.required}` : ""}
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
        <p className="mt-3 text-sm text-ink-3">Pflichtprogramme: {course.requiredPrograms.map((p) => p.name).join(", ")}</p>
      ) : null}
      {course.notes ? (
        <Card className="mt-4 whitespace-pre-line p-4 text-sm text-ink-2">{course.notes}</Card>
      ) : null}

      <div className="mt-6 rounded-card bg-surface-2 p-4 text-xs text-ink-3">
        {isCourseKind(course.kind) ? <p className="mb-1">{COURSE_KIND[course.kind].text}</p> : null}
        <p>{RESPONSIBILITY_HINT}</p>
      </div>

      <div className="mt-6 flex justify-end">
        <NavActionButton
          to="/courses"
          variant="ghost"
          action={deleteCourseAction.bind(null, course.id)}
          confirm={{ title: "Kurs löschen?", message: "Teilnehmende, Lektionen, Präsenz und Resultate des Kurses werden gelöscht, ebenso die dafür erstellten Kalendereinträge.", tone: "danger", confirmLabel: "Löschen" }}
        >
          <Trash2 className="h-4 w-4" /> Kurs löschen
        </NavActionButton>
      </div>
    </div>
  );
}
