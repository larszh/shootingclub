import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { db } from "@/lib/db";
import { requireCoursesManage } from "@/modules/courses/guard";
import { ImportForm } from "@/modules/courses/ui/import-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.courses.import.title") };
}

export default async function ImportParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCoursesManage();
  const t = getT(await getRequestLocale());
  const { id } = await params;
  const course = await db.course.findFirst({ where: { id: id.slice(0, 40), tenantId: ctx.tenant.id }, select: { id: true, name: true } });
  if (!course) notFound();
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("adm2.courses.import.title")} subtitle={course.name} back={{ href: `/courses/${course.id}`, label: t("adm2.courses.course") }} />
      <ImportForm courseId={course.id} />
      <p className="mt-4 text-xs text-ink-3">{t("adm2.courses.import.footer")}</p>
    </div>
  );
}
