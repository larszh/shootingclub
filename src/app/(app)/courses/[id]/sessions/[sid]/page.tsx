import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { formatDateZurich, formatTimeRange, todayZurich } from "@/lib/time";
import { requireCoursesManage } from "@/modules/courses/guard";
import { ageOn, courseReferenceDay } from "@/modules/courses/logic";
import { getCourse } from "@/modules/courses/queries";
import { AttendanceTaker } from "@/modules/courses/ui/attendance-taker";

export const metadata: Metadata = { title: "Präsenz" };

export default async function SessionAttendancePage({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const ctx = await requireCoursesManage();
  const { id, sid } = await params;
  const course = await getCourse(ctx.tenant.id, id.slice(0, 40));
  if (!course) notFound();
  const session = course.sessions.find((s) => s.id === sid);
  if (!session) notFound();
  const refDay = courseReferenceDay(course.startsOnDay, todayZurich());
  const people = course.participants
    .filter((p) => p.status !== "DROPPED")
    .map((p) => {
      const age = ageOn(p.birthDay, refDay);
      const v = course.attendanceIdx.get(`${session.id}|${p.id}`);
      return {
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        sub: [age !== null && age < 18 ? `${age} J.` : null, p.weapon?.name ?? null].filter(Boolean).join(" · ") || null,
        present: v === undefined ? null : v,
      };
    });
  return (
    <div className="max-w-xl">
      <PageHeader
        title={session.title}
        subtitle={`${course.name} · ${formatDateZurich(session.startsAt)}${session.endsAt ? `, ${formatTimeRange(session.startsAt, session.endsAt)}` : ""}`}
        back={{ href: `/courses/${course.id}/sessions`, label: "Lektionen" }}
      />
      <AttendanceTaker sessionId={session.id} people={people} backHref={`/courses/${course.id}`} />
    </div>
  );
}
