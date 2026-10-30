import { notFound } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { todayZurich } from "@/lib/time";
import { PrintSheet, PrintTable, printedAt, SignatureLines } from "@/modules/ammo/ui/print-sheet";
import { requireCoursesManage } from "@/modules/courses/guard";
import { ageOn, chDate, courseReferenceDay } from "@/modules/courses/logic";
import { getCourse } from "@/modules/courses/queries";
import { courseKindLabel, participantStatusInfo, RESPONSIBILITY_HINT } from "@/modules/courses/types";

export const metadata = { title: "Teilnehmerliste" };

/** Teilnehmerliste eines Kurses (A4) mit Kontakt, Erziehungsberechtigten, Waffe und Präsenz. ?all=1 inkl. Ausgetretene. */
export default async function CourseParticipantListPrint({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ all?: string }> }) {
  const ctx = await requireCoursesManage();
  const { id } = await params;
  const sp = await searchParams;
  const course = await getCourse(ctx.tenant.id, id.slice(0, 40));
  if (!course) notFound();
  const refDay = courseReferenceDay(course.startsOnDay, todayZurich());
  const people = sp.all === "1" ? course.participants : course.participants.filter((p) => p.status !== "DROPPED");
  const dates = [chDate(course.startsOnDay), chDate(course.endsOnDay)].filter(Boolean).join(" – ");
  const rows = people.map((p, i) => {
    const age = ageOn(p.birthDay, refDay);
    return [
      String(i + 1),
      <div key="n"><div className="font-medium">{p.lastName} {p.firstName}</div>{p.note ? <div className="text-[8pt] text-neutral-500">{p.note}</div> : null}</div>,
      <div key="b">{chDate(p.birthDay)}{age !== null ? <div className="text-[8pt] text-neutral-500">{age} J.</div> : null}</div>,
      <div key="c" className="break-all">{[p.phone, p.email].filter(Boolean).join(", ")}</div>,
      <div key="g">{p.guardianName ? <>{p.guardianName}<div className="text-[8pt] text-neutral-500 break-all">{[p.guardianPhone, p.guardianEmail].filter(Boolean).join(", ")}</div></> : ""}</div>,
      p.weapon?.name ?? "",
      `${p.attendance.present}/${p.attendance.total}`,
      participantStatusInfo(p.status).label,
    ];
  });
  return (
    <PrintShell title="Teilnehmerliste" subtitle={`${course.name} · ${people.length} Personen`} action={<PrintButton />}>
      <PrintSheet
        tenantName={ctx.tenant.name}
        title={`Teilnehmerliste ${course.name}`}
        subtitle={[courseKindLabel(course.kind), dates || String(course.year), course.leaderName ? `Leitung: ${course.leaderName}` : null].filter(Boolean).join(" · ")}
        footer={<>Erstellt mit Standchef am {printedAt()}. Vertrauliche Personendaten – nur für die Kursleitung. {RESPONSIBILITY_HINT}</>}
      >
        {people.length ? (
          <PrintTable head={["#", "Name", "Geburtsdatum", "Kontakt", "Erziehungsberechtigte", "Waffe", "Präsenz", "Status"]} rows={rows} align={["right", "left", "left", "left", "left", "left", "right", "left"]} />
        ) : (
          <p className="py-6 text-neutral-500">Keine Teilnehmenden.</p>
        )}
        {course.requiredPrograms.length ? <p className="mt-4 text-[9pt] text-neutral-600">Pflichtprogramme: {course.requiredPrograms.map((p) => p.name).join(", ")}</p> : null}
        <SignatureLines labels={["Ort, Datum", "Kursleitung"]} />
      </PrintSheet>
    </PrintShell>
  );
}
