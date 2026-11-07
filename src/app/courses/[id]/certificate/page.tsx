import { notFound, redirect } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { PrintSheet, PrintTable, printedAt, SignatureLines } from "@/modules/ammo/ui/print-sheet";
import { requireCourses } from "@/modules/courses/guard";
import { getRequestLocale, getT } from "@/lib/i18n";
import { dayKeyLabel } from "@/lib/i18n/extra/admin2/msg";
import { dbDay } from "@/modules/courses/logic";
import { getCourse, type CourseDetail } from "@/modules/courses/queries";
import { courseKindLabel, isCourseKind } from "@/modules/courses/types";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm2.courses.pr.cert") };
}

type P = CourseDetail["participants"][number];

/** «Erfolgreich abgeschlossen» nur, wenn der Abschluss bestätigt ist und alle Pflichtprogramme (noch) bestanden sind. */
const isCompleted = (p: P) => p.status === "COMPLETED" && p.completion.allPassed;

/**
 * Kursausweise (je eine A4-Seite). ?p=<id> für eine Person, sonst alle Abgeschlossenen.
 * Teilnehmende mit Konto dürfen den eigenen Ausweis drucken, sobald der Kurs abgeschlossen ist.
 */
export default async function CourseCertificatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ p?: string }> }) {
  const ctx = await requireCourses();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const chDate = (d: string | null) => dayKeyLabel(d, locale);
  const { id } = await params;
  const sp = await searchParams;
  const course = await getCourse(ctx.tenant.id, id.slice(0, 40));
  if (!course) notFound();
  const canManage = ctx.can("courses.manage");
  let people: P[];
  if (canManage) {
    people = sp.p ? course.participants.filter((p) => p.id === sp.p) : course.participants.filter(isCompleted);
  } else {
    const me = course.participants.find((p) => p.userId === ctx.user.id && isCompleted(p));
    if (!me) redirect("/courses?denied=1");
    people = [me];
  }
  const dates = [chDate(course.startsOnDay), chDate(course.endsOnDay)].filter(Boolean).join(" – ");
  return (
    <PrintShell title={t("adm2.courses.pr.certs")} subtitle={`${course.name} · ${t(people.length === 1 ? "adm2.common.pages.one" : "adm2.common.pages.other", { n: people.length })}`} action={<PrintButton />}>
      {people.length === 0 ? <p className="py-10 text-sm text-neutral-600">{t("adm2.courses.pr.noneDone")}</p> : null}
      {people.map((p) => (
        <PrintSheet
          key={p.id}
          tenantName={ctx.tenant.name}
          title={t("adm2.courses.pr.cert")}
          subtitle={course.name}
          footer={<>{t("adm2.courses.pr.issued", { date: printedAt(locale) })} {t("adm2.courses.responsibility")}</>}
        >
          <div className="mb-5 rounded border border-neutral-300 p-4">
            <div className="text-[9pt] uppercase tracking-wide text-neutral-500">{t("adm2.courses.pr.participant")}</div>
            <div className="mt-1 text-xl font-semibold">{p.firstName} {p.lastName}</div>
            {p.birthDay ? <div className="text-neutral-700">{t("adm2.courses.pr.born", { date: chDate(p.birthDay) })}</div> : null}
            {[p.street, [p.zip, p.city].filter(Boolean).join(" ")].filter(Boolean).length ? <div className="text-neutral-700">{[p.street, [p.zip, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</div> : null}
          </div>
          <p className="mb-4">
            {t(isCompleted(p) ? "adm2.courses.pr.completedText" : "adm2.courses.pr.attendedText", {
              course: course.name,
              kind: isCourseKind(course.kind) ? ` (${courseKindLabel(course.kind, t)})` : "",
              dates: dates ? t("adm2.courses.pr.from", { dates }) : ` ${course.year}`,
            })}
          </p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div><span className="text-neutral-500">{t("adm2.courses.pr.attendance")}</span> {t("adm2.courses.pr.attendanceN", { n: p.attendance.present, total: p.attendance.total })}</div>
            {course.leaderName ? <div><span className="text-neutral-500">{t("adm2.courses.pr.leader")}</span> {course.leaderName}</div> : null}
          </div>
          {course.requiredPrograms.length ? (
            <>
              <h2 className="mb-1 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">{t("adm2.courses.form.required")}</h2>
              <PrintTable
                head={[t("adm2.courses.pr.program"), t("adm2.common.date"), t("adm2.courses.pr.points"), t("adm2.courses.pr.result")]}
                align={["left", "left", "right", "left"]}
                rows={course.requiredPrograms.map((prog) => {
                  const cell = p.completion.cells[prog.id]!;
                  return [prog.name, cell.best ? chDate(cell.best.date) : "", cell.best?.score ?? "", cell.state === "passed" ? t("adm2.courses.pp.passed") : cell.state === "failed" ? t("adm2.courses.pp.failed") : t("adm2.courses.r.open")];
                })}
              />
            </>
          ) : null}
          {p.results.filter((r) => !r.programId || !course.requiredPrograms.some((x) => x.id === r.programId)).length ? (
            <>
              <h2 className="mb-1 mt-4 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">{t("adm2.courses.pp.other")}</h2>
              <PrintTable
                head={[t("adm2.courses.pr.program"), t("adm2.common.date"), t("adm2.courses.pr.points"), t("adm2.courses.pr.result")]}
                align={["left", "left", "right", "left"]}
                rows={p.results.filter((r) => !r.programId || !course.requiredPrograms.some((x) => x.id === r.programId)).map((r) => [r.label, chDate(dbDay(r.date)), r.score ?? "", r.passed ? t("adm2.courses.pp.passed") : t("adm2.courses.pp.failed")])}
              />
            </>
          ) : null}
          <SignatureLines labels={[t("adm2.common.placeDate"), t("adm2.courses.pr.leaderSig")]} />
        </PrintSheet>
      ))}
    </PrintShell>
  );
}
