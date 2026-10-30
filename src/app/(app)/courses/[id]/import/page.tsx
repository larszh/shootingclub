import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireCoursesManage } from "@/modules/courses/guard";
import { ImportForm } from "@/modules/courses/ui/import-form";

export const metadata: Metadata = { title: "Teilnehmende importieren" };

export default async function ImportParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCoursesManage();
  const { id } = await params;
  const course = await db.course.findFirst({ where: { id: id.slice(0, 40), tenantId: ctx.tenant.id }, select: { id: true, name: true } });
  if (!course) notFound();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Teilnehmende importieren" subtitle={course.name} back={{ href: `/courses/${course.id}`, label: "Kurs" }} />
      <ImportForm courseId={course.id} />
      <p className="mt-4 text-xs text-ink-3">Importiert werden nur Kursangaben (ohne App-Konto). Bei unter 18-Jährigen sind die Angaben der erziehungsberechtigten Person Pflicht. Bitte keine AHV-Nummern erfassen.</p>
    </div>
  );
}
