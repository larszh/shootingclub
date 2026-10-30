import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireCoursesManage } from "@/modules/courses/guard";
import { leaderOptions, programOptions } from "@/modules/courses/queries";
import { CourseForm } from "@/modules/courses/ui/course-form";

export const metadata: Metadata = { title: "Neuer Kurs" };

export default async function NewCoursePage() {
  const ctx = await requireCoursesManage();
  const [programs, leaders] = await Promise.all([programOptions(ctx.tenant.id), leaderOptions(ctx.tenant.id)]);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Neuer Kurs" back={{ href: "/courses", label: "Kurse" }} />
      <CourseForm programs={programs} leaders={leaders} defaultYear={Number(todayZurich().slice(0, 4))} />
    </div>
  );
}
