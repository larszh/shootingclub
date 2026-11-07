import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { todayZurich } from "@/lib/time";
import { requireCoursesManage } from "@/modules/courses/guard";
import { leaderOptions, programOptions } from "@/modules/courses/queries";
import { CourseForm } from "@/modules/courses/ui/course-form";
import { localizedProgramName } from "@/modules/scores/preset-i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.courses.new.title") };
}

export default async function NewCoursePage() {
  const ctx = await requireCoursesManage();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const [programs, leaders] = await Promise.all([programOptions(ctx.tenant.id), leaderOptions(ctx.tenant.id)]);
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("adm2.courses.new.title")} back={{ href: "/courses", label: t("adm2.courses.title") }} />
      <CourseForm programs={programs.map((p) => ({ ...p, name: localizedProgramName(p.name, locale) }))} leaders={leaders} defaultYear={Number(todayZurich().slice(0, 4))} />
    </div>
  );
}
