import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { db } from "@/lib/db";
import { todayZurich } from "@/lib/time";
import { requireCoursesManage } from "@/modules/courses/guard";
import { dbDay, parseIdCsv } from "@/modules/courses/logic";
import { leaderOptions, programOptions, programsByIds } from "@/modules/courses/queries";
import { CourseForm } from "@/modules/courses/ui/course-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.courses.edit.title") };
}

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCoursesManage();
  const t = getT(await getRequestLocale());
  const { id } = await params;
  const c = await db.course.findFirst({ where: { id: id.slice(0, 40), tenantId: ctx.tenant.id } });
  if (!c) notFound();
  const required = parseIdCsv(c.requiredProgramIds);
  const [programs, leaders, current] = await Promise.all([programOptions(ctx.tenant.id), leaderOptions(ctx.tenant.id), programsByIds(ctx.tenant.id, required)]);
  // Bereits gewählte, inzwischen versteckte/archivierte Programme weiter anzeigen
  const all = [...programs, ...current.filter((p) => !programs.some((x) => x.id === p.id))];
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("adm2.courses.edit.title")} subtitle={c.name} back={{ href: `/courses/${c.id}`, label: t("adm2.courses.course") }} />
      <CourseForm
        programs={all}
        leaders={leaders}
        defaultYear={Number(todayZurich().slice(0, 4))}
        initial={{
          id: c.id, name: c.name, kind: c.kind, year: c.year, startsOn: dbDay(c.startsOn), endsOn: dbDay(c.endsOn), leaderUserId: c.leaderUserId,
          minParticipants: c.minParticipants, requiredProgramIds: required, notes: c.notes, status: c.status,
        }}
      />
    </div>
  );
}
