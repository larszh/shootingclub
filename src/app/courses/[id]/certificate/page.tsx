import { notFound, redirect } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { PrintSheet, PrintTable, printedAt, SignatureLines } from "@/modules/ammo/ui/print-sheet";
import { requireCourses } from "@/modules/courses/guard";
import { chDate, dbDay } from "@/modules/courses/logic";
import { getCourse, type CourseDetail } from "@/modules/courses/queries";
import { COURSE_KIND, isCourseKind, RESPONSIBILITY_HINT } from "@/modules/courses/types";

export const metadata = { title: "Kursausweis" };

type P = CourseDetail["participants"][number];

/**
 * Kursausweise (je eine A4-Seite). ?p=<id> für eine Person, sonst alle Abgeschlossenen.
 * Teilnehmende mit Konto dürfen den eigenen Ausweis drucken, sobald der Kurs abgeschlossen ist.
 */
export default async function CourseCertificatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ p?: string }> }) {
  const ctx = await requireCourses();
  const { id } = await params;
  const sp = await searchParams;
  const course = await getCourse(ctx.tenant.id, id.slice(0, 40));
  if (!course) notFound();
  const canManage = ctx.can("courses.manage");
  let people: P[];
  if (canManage) {
    people = sp.p ? course.participants.filter((p) => p.id === sp.p) : course.participants.filter((p) => p.status === "COMPLETED");
  } else {
    const me = course.participants.find((p) => p.userId === ctx.user.id && p.status === "COMPLETED");
    if (!me) redirect("/courses?denied=1");
    people = [me];
  }
  const dates = [chDate(course.startsOnDay), chDate(course.endsOnDay)].filter(Boolean).join(" – ");
  return (
    <PrintShell title="Kursausweise" subtitle={`${course.name} · ${people.length} ${people.length === 1 ? "Seite" : "Seiten"}`} action={<PrintButton />}>
      {people.length === 0 ? <p className="py-10 text-sm text-neutral-600">Noch niemand hat den Kurs abgeschlossen.</p> : null}
      {people.map((p) => (
        <PrintSheet
          key={p.id}
          tenantName={ctx.tenant.name}
          title="Kursausweis"
          subtitle={course.name}
          footer={<>Ausgestellt mit Standchef am {printedAt()}. {RESPONSIBILITY_HINT}</>}
        >
          <div className="mb-5 rounded border border-neutral-300 p-4">
            <div className="text-[9pt] uppercase tracking-wide text-neutral-500">Teilnehmer:in</div>
            <div className="mt-1 text-xl font-semibold">{p.firstName} {p.lastName}</div>
            {p.birthDay ? <div className="text-neutral-700">geboren am {chDate(p.birthDay)}</div> : null}
            {[p.street, [p.zip, p.city].filter(Boolean).join(" ")].filter(Boolean).length ? <div className="text-neutral-700">{[p.street, [p.zip, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</div> : null}
          </div>
          <p className="mb-4">
            {p.status === "COMPLETED" ? "hat den Kurs " : "hat am Kurs "}
            <strong>{course.name}</strong>
            {isCourseKind(course.kind) ? ` (${COURSE_KIND[course.kind].label})` : ""}
            {dates ? ` vom ${dates}` : ` ${course.year}`}
            {p.status === "COMPLETED" ? " erfolgreich abgeschlossen." : " teilgenommen."}
          </p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div><span className="text-neutral-500">Präsenz:</span> {p.attendance.present} von {p.attendance.total} Lektionen</div>
            {course.leaderName ? <div><span className="text-neutral-500">Kursleitung:</span> {course.leaderName}</div> : null}
          </div>
          {course.requiredPrograms.length ? (
            <>
              <h2 className="mb-1 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">Pflichtprogramme</h2>
              <PrintTable
                head={["Programm", "Datum", "Punkte", "Ergebnis"]}
                align={["left", "left", "right", "left"]}
                rows={course.requiredPrograms.map((prog) => {
                  const cell = p.completion.cells[prog.id]!;
                  return [prog.name, cell.best ? chDate(cell.best.date) : "", cell.best?.score ?? "", cell.state === "passed" ? "bestanden" : cell.state === "failed" ? "nicht bestanden" : "offen"];
                })}
              />
            </>
          ) : null}
          {p.results.filter((r) => !r.programId || !course.requiredPrograms.some((x) => x.id === r.programId)).length ? (
            <>
              <h2 className="mb-1 mt-4 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">Weitere Resultate</h2>
              <PrintTable
                head={["Programm", "Datum", "Punkte", "Ergebnis"]}
                align={["left", "left", "right", "left"]}
                rows={p.results.filter((r) => !r.programId || !course.requiredPrograms.some((x) => x.id === r.programId)).map((r) => [r.label, chDate(dbDay(r.date)), r.score ?? "", r.passed ? "bestanden" : "nicht bestanden"])}
              />
            </>
          ) : null}
          <SignatureLines labels={["Ort, Datum", "Kursleitung"]} />
        </PrintSheet>
      ))}
    </PrintShell>
  );
}
