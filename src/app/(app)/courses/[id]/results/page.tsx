import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Download, GraduationCap, IdCard } from "lucide-react";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { completeParticipantAction } from "@/modules/courses/actions";
import { requireCoursesManage } from "@/modules/courses/guard";
import { canComplete } from "@/modules/courses/logic";
import { getCourse } from "@/modules/courses/queries";
import { participantStatusInfo } from "@/modules/courses/types";
import { CellIcon } from "@/modules/courses/ui/my-course";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.courses.r.title") };
}

export default async function CourseResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCoursesManage();
  const t = getT(await getRequestLocale());
  const { id } = await params;
  const course = await getCourse(ctx.tenant.id, id.slice(0, 40));
  if (!course) notFound();
  const base = `/courses/${course.id}`;
  const people = course.participants.filter((p) => p.status !== "DROPPED");
  const progs = course.requiredPrograms;
  const ready = people.filter((p) => canComplete(p.completion, p.status)).length;

  return (
    <div>
      <PageHeader title={t("adm2.courses.r.title")} subtitle={t("adm2.courses.r.subtitle", { name: course.name })} back={{ href: base, label: t("adm2.courses.course") }} />
      <div className="mb-4 flex flex-wrap gap-2">
        <LinkButton href={`/api/export/courses?course=${course.id}&kind=results`} variant="ghost" prefetch={false}><Download className="h-4 w-4" /> CSV</LinkButton>
        <LinkButton href={`${base}/certificate`} variant="ghost" prefetch={false}><IdCard className="h-4 w-4" /> {t("adm2.courses.r.print")}</LinkButton>
      </div>

      {progs.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title={t("adm2.courses.r.none")}
          text={t("adm2.courses.r.noneText")}
          action={<LinkButton href={`${base}/edit`}>{t("adm2.courses.edit.title")}</LinkButton>}
        />
      ) : null}

      {people.length === 0 ? (
        <p className="text-sm text-ink-3">{t("adm2.courses.r.noParticipants")}</p>
      ) : (
        <>
          {ready ? <p className="mb-2 text-sm text-ok">{t(ready === 1 ? "adm2.courses.r.ready.one" : "adm2.courses.r.ready.other", { n: ready })}</p> : null}
          <Card className="animate-rise overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium">{t("adm2.common.name")}</th>
                  {progs.map((p) => <th key={p.id} scope="col" className="min-w-20 max-w-32 px-2 py-2 text-center text-xs font-medium text-ink-3"><span className="line-clamp-2">{p.name}</span></th>)}
                  <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">{t("adm2.courses.r.completion")}</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => {
                  const st = participantStatusInfo(p.status, t);
                  return (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <th scope="row" className="sticky left-0 z-10 max-w-44 bg-surface px-3 py-2 text-left font-normal">
                        <Link href={`${base}/participants/${p.id}`} className="block min-h-11 truncate py-2.5 hover:underline">{p.lastName} {p.firstName}</Link>
                      </th>
                      {progs.map((prog) => {
                        const cell = p.completion.cells[prog.id]!;
                        return (
                          <td key={prog.id} className="px-2 py-2 text-center">
                            <Link href={`${base}/participants/${p.id}`} className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center rounded-control hover:bg-surface-2" aria-label={`${prog.name}: ${cell.state === "passed" ? t("adm2.courses.pp.passed") : cell.state === "failed" ? t("adm2.courses.pp.failed") : t("adm2.courses.r.open")}`}>
                              <CellIcon state={cell.state} t={t} />
                              {cell.best?.score != null ? <span className="text-[11px] tabular-nums text-ink-3">{cell.best.score}</span> : null}
                            </Link>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right">
                        {canComplete(p.completion, p.status) ? (
                          <ActionButton size="sm" action={completeParticipantAction.bind(null, p.id)} confirm={{ title: t("adm2.courses.r.completeQ", { name: `${p.firstName} ${p.lastName}` }), message: t("adm2.courses.r.completeText"), confirmLabel: t("adm2.courses.r.complete") }}>
                            <GraduationCap className="h-4 w-4" /> {t("adm2.courses.r.complete")}
                          </ActionButton>
                        ) : (
                          <Badge tone={st.tone}>{st.label}</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <p className="mt-2 text-xs text-ink-3">{t("adm2.courses.r.legend")}</p>
        </>
      )}
    </div>
  );
}
