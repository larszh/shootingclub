import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { db } from "@/lib/db";
import { todayZurich } from "@/lib/time";
import { requireCoursesManage } from "@/modules/courses/guard";
import { courseReferenceDay, dbDay } from "@/modules/courses/logic";
import { memberOptions } from "@/modules/courses/queries";
import { ParticipantForm } from "@/modules/courses/ui/participant-form";
import { listAvailableWeapons } from "@/modules/weapons/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.courses.pnew.title") };
}

export default async function NewParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCoursesManage();
  const t = getT(await getRequestLocale());
  const { id } = await params;
  const course = await db.course.findFirst({ where: { id: id.slice(0, 40), tenantId: ctx.tenant.id }, select: { id: true, name: true, startsOn: true, participants: { select: { userId: true } } } });
  if (!course) notFound();
  const weaponsEnabled = ctx.hasModule("weapons");
  const [members, weapons] = await Promise.all([memberOptions(ctx.tenant.id), weaponsEnabled ? listAvailableWeapons(ctx.tenant.id) : Promise.resolve([])]);
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("adm2.courses.pnew.title")} subtitle={course.name} back={{ href: `/courses/${course.id}`, label: t("adm2.courses.course") }} />
      <ParticipantForm
        courseId={course.id}
        members={members}
        weapons={weapons}
        currentWeapon={null}
        weaponsEnabled={weaponsEnabled}
        refDay={courseReferenceDay(dbDay(course.startsOn), todayZurich())}
        takenUserIds={course.participants.map((p) => p.userId).filter((x): x is string => !!x)}
      />
    </div>
  );
}
