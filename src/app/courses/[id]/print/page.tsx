import { notFound } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { todayZurich } from "@/lib/time";
import { PrintSheet, PrintTable, printedAt, SignatureLines } from "@/modules/ammo/ui/print-sheet";
import { requireCoursesManage } from "@/modules/courses/guard";
import { getRequestLocale, getT } from "@/lib/i18n";
import { dayKeyLabel } from "@/lib/i18n/extra/admin2/msg";
import { ageOn, courseReferenceDay } from "@/modules/courses/logic";
import { getCourse } from "@/modules/courses/queries";
import { courseKindLabel, participantStatusInfo } from "@/modules/courses/types";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm2.courses.pr.list") };
}

/** Teilnehmerliste eines Kurses (A4) mit Kontakt, Erziehungsberechtigten, Waffe und Präsenz. ?all=1 inkl. Ausgetretene. */
export default async function CourseParticipantListPrint({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ all?: string }> }) {
  const ctx = await requireCoursesManage();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const chDate = (d: string | null) => dayKeyLabel(d, locale);
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
      <div key="b">{chDate(p.birthDay)}{age !== null ? <div className="text-[8pt] text-neutral-500">{t("adm2.courses.d.ageShort", { n: age })}</div> : null}</div>,
      <div key="c" className="break-all">{[p.phone, p.email].filter(Boolean).join(", ")}</div>,
      <div key="g">{p.guardianName ? <>{p.guardianName}<div className="text-[8pt] text-neutral-500 break-all">{[p.guardianPhone, p.guardianEmail].filter(Boolean).join(", ")}</div></> : ""}</div>,
      p.weapon?.name ?? "",
      `${p.attendance.present}/${p.attendance.total}`,
      participantStatusInfo(p.status, t).label,
    ];
  });
  return (
    <PrintShell title={t("adm2.courses.pr.list")} subtitle={`${course.name} · ${t("adm2.courses.pr.people", { n: people.length })}`} action={<PrintButton />}>
      <PrintSheet
        tenantName={ctx.tenant.name}
        title={t("adm2.courses.pr.listTitle", { course: course.name })}
        subtitle={[courseKindLabel(course.kind, t), dates || String(course.year), course.leaderName ? t("adm2.courses.d.leader", { name: course.leaderName }) : null].filter(Boolean).join(" · ")}
        footer={<>{t("adm2.common.createdWith", { date: printedAt(locale) })} {t("adm2.courses.pr.confidential")} {t("adm2.courses.responsibility")}</>}
      >
        {people.length ? (
          <PrintTable head={["#", t("adm2.common.name"), t("adm2.courses.p.birth"), t("adm2.courses.pr.contact"), t("adm2.courses.pr.guardian"), t("adm2.courses.pr.weapon"), t("adm2.courses.pr.att"), t("adm2.common.status")]} rows={rows} align={["right", "left", "left", "left", "left", "left", "right", "left"]} />
        ) : (
          <p className="py-6 text-neutral-500">{t("adm2.courses.pr.noParticipants")}</p>
        )}
        {course.requiredPrograms.length ? <p className="mt-4 text-[9pt] text-neutral-600">{t("adm2.courses.d.requiredList", { list: course.requiredPrograms.map((p) => p.name).join(", ") })}</p> : null}
        <SignatureLines labels={[t("adm2.common.placeDate"), t("adm2.courses.pr.leaderSig")]} />
      </PrintSheet>
    </PrintShell>
  );
}
