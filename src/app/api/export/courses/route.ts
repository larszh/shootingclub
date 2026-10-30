import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { todayZurich, zurichParts } from "@/lib/time";
import { slugify } from "@/lib/utils";
import { csvResponse, toCsv } from "@/modules/billing/csv";
import { ageOn, chDate, courseReferenceDay, ndsAttendanceRows } from "@/modules/courses/logic";
import { getCourse } from "@/modules/courses/queries";
import { participantStatusInfo } from "@/modules/courses/types";

export const dynamic = "force-dynamic";

/**
 * Kurs-Exporte als CSV (Semikolon, UTF-8 mit BOM, Schutz gegen Formel-Injection), nur für «courses.manage».
 * ?course=<id>&kind=attendance (Präsenz im Aufbau für die NDS: Name; Vorname; Geburtsdatum; je Lektion 1/0)
 *   | participants (Teilnehmende mit Kontakt) | results (Pflichtprogramm-Matrix)
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("Kein Verein ausgewählt", { status: 400 });
  if (!ctx.hasModule("courses")) return new NextResponse("Modul nicht aktiv", { status: 403 });
  if (!ctx.can("courses.manage")) return new NextResponse("Keine Berechtigung", { status: 403 });
  const courseId = (req.nextUrl.searchParams.get("course") ?? "").slice(0, 40);
  const kind = req.nextUrl.searchParams.get("kind") ?? "attendance";
  const course = courseId ? await getCourse(ctx.tenant.id, courseId) : null;
  if (!course) return new NextResponse("Kurs nicht gefunden", { status: 404 });
  const name = slugify(course.name) || "kurs";
  const today = todayZurich();
  const people = course.participants.filter((p) => p.status !== "DROPPED");

  if (kind === "participants") {
    const refDay = courseReferenceDay(course.startsOnDay, today);
    const header = ["Name", "Vorname", "Geburtsdatum", "Alter", "E-Mail", "Telefon", "Strasse", "PLZ", "Ort", "Erziehungsberechtigte", "E-Mail Erziehungsberechtigte", "Telefon Erziehungsberechtigte", "Vereinswaffe", "Status", "Präsenz", "Mitglied", "Bemerkung"];
    const rows = course.participants.map((p) => [
      p.lastName, p.firstName, chDate(p.birthDay), ageOn(p.birthDay, refDay) ?? "", p.email ?? "", p.phone ?? "", p.street ?? "", p.zip ?? "", p.city ?? "",
      p.guardianName ?? "", p.guardianEmail ?? "", p.guardianPhone ?? "", p.weapon?.name ?? "", participantStatusInfo(p.status).label,
      `${p.attendance.present}/${p.attendance.total}`, p.userId ? "ja" : "nein", p.note ?? "",
    ]);
    return csvResponse(toCsv([header, ...rows]), `kurs-teilnehmende-${name}-${today}.csv`);
  }

  if (kind === "results") {
    const header = ["Name", "Vorname", "Geburtsdatum", ...course.requiredPrograms.flatMap((p) => [`${p.name} Punkte`, `${p.name} bestanden`]), "Alle bestanden", "Status"];
    const rows = people.map((p) => [
      p.lastName, p.firstName, chDate(p.birthDay),
      ...course.requiredPrograms.flatMap((prog) => {
        const c = p.completion.cells[prog.id]!;
        return [c.best?.score ?? "", c.state === "passed" ? "ja" : c.state === "failed" ? "nein" : ""];
      }),
      p.completion.allPassed ? "ja" : "nein", participantStatusInfo(p.status).label,
    ]);
    return csvResponse(toCsv([header, ...rows]), `kurs-resultate-${name}-${today}.csv`);
  }

  const rows = ndsAttendanceRows(
    people.map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, birthDay: p.birthDay })),
    course.sessions.map((s) => ({ id: s.id, day: zurichParts(s.startsAt).dateStr })),
    course.sessions.flatMap((s) => s.attendance),
  );
  return csvResponse(toCsv(rows), `kurs-praesenz-${name}-${today}.csv`);
}

