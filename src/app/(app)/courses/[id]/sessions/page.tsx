import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Check, ChevronRight, Download, Minus, Trash2, X } from "lucide-react";
import { Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { formatDateZurich, formatTimeRange, todayZurich, zurichParts } from "@/lib/time";
import { deleteSessionAction } from "@/modules/courses/actions";
import { requireCoursesManage } from "@/modules/courses/guard";
import { getCourse } from "@/modules/courses/queries";
import { SessionForm } from "@/modules/courses/ui/session-form";

export const metadata: Metadata = { title: "Lektionen & Präsenz" };

const short = (d: Date) => formatDateZurich(d, { weekday: undefined, year: undefined });

export default async function SessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCoursesManage();
  const { id } = await params;
  const course = await getCourse(ctx.tenant.id, id.slice(0, 40));
  if (!course) notFound();
  const today = todayZurich();
  const base = `/courses/${course.id}`;
  const people = course.participants.filter((p) => p.status !== "DROPPED");
  const defaultDate = course.startsOnDay && course.startsOnDay > today && !course.sessions.length ? course.startsOnDay : today;

  return (
    <div>
      <PageHeader title="Lektionen & Präsenz" subtitle={course.name} back={{ href: base, label: "Kurs" }} />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <section>
            <SectionTitle>Lektionen</SectionTitle>
            {course.sessions.length === 0 ? (
              <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Noch keine Lektionen" text="Lege die Kurstage an. Danach erfasst du die Präsenz direkt am Stand." />
            ) : (
              <Card className="divide-y divide-line overflow-hidden">
                {course.sessions.map((s) => {
                  const present = people.filter((p) => course.attendanceIdx.get(`${s.id}|${p.id}`) === true).length;
                  const recorded = people.filter((p) => course.attendanceIdx.has(`${s.id}|${p.id}`)).length;
                  const isToday = zurichParts(s.startsAt).dateStr === today;
                  return (
                    <div key={s.id} className="flex items-center gap-2 pr-2">
                      <Link href={`${base}/sessions/${s.id}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{s.title}{isToday ? <span className="ml-2 text-xs text-accent">heute</span> : null}</div>
                          <div className="text-xs text-ink-3">
                            {formatDateZurich(s.startsAt)}{s.endsAt ? `, ${formatTimeRange(s.startsAt, s.endsAt)}` : ""}
                            {" · "}{recorded ? `${present}/${people.length} anwesend` : "Präsenz offen"}{s.eventId ? " · im Kalender" : ""}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
                      </Link>
                      <ActionButton
                        variant="ghost" size="sm" className="h-11 w-11 shrink-0 px-0" aria-label={`${s.title} löschen`}
                        action={deleteSessionAction.bind(null, s.id)}
                        confirm={{ title: "Lektion löschen?", message: s.eventId ? "Die erfasste Präsenz und der Kalendereintrag werden ebenfalls gelöscht." : "Die erfasste Präsenz wird ebenfalls gelöscht.", tone: "danger", confirmLabel: "Löschen" }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </ActionButton>
                    </div>
                  );
                })}
              </Card>
            )}
          </section>

          {course.sessions.length && people.length ? (
            <section>
              <SectionTitle action={<LinkButton href={`/api/export/courses?course=${course.id}&kind=attendance`} size="sm" variant="ghost" prefetch={false}><Download className="h-4 w-4" /> CSV{course.kind === "JS" ? " für NDS" : ""}</LinkButton>}>Präsenzmatrix</SectionTitle>
              <Card className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium">Name</th>
                      {course.sessions.map((s) => (
                        <th key={s.id} scope="col" className="px-1.5 py-2 text-center text-xs font-medium text-ink-3">
                          <Link href={`${base}/sessions/${s.id}`} className="hover:underline">{short(s.startsAt)}</Link>
                        </th>
                      ))}
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((p) => (
                      <tr key={p.id} className="border-b border-line last:border-0">
                        <th scope="row" className="sticky left-0 z-10 max-w-40 truncate bg-surface px-3 py-2 text-left font-normal">{p.lastName} {p.firstName}</th>
                        {course.sessions.map((s) => {
                          const v = course.attendanceIdx.get(`${s.id}|${p.id}`);
                          return (
                            <td key={s.id} className="px-1.5 py-2 text-center">
                              {v === true ? <Check className="mx-auto h-4 w-4 text-ok" aria-label="anwesend" /> : v === false ? <X className="mx-auto h-4 w-4 text-danger" aria-label="abwesend" /> : <Minus className="mx-auto h-4 w-4 text-ink-3" aria-label="nicht erfasst" />}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right tabular-nums">{p.attendance.present}/{p.attendance.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              {course.kind === "JS" ? <p className="mt-2 text-xs text-ink-3">Die CSV-Datei hat den Aufbau Name; Vorname; Geburtsdatum; je Lektion 1/0 zur Übertragung in die NDS durch den J+S-Coach. Es besteht keine direkte Verbindung zur NDS.</p> : null}
            </section>
          ) : null}
        </div>

        <aside>
          <SectionTitle>Neue Lektion</SectionTitle>
          <Card className="p-4">
            <SessionForm courseId={course.id} defaultDate={defaultDate} eventsEnabled={ctx.hasModule("events")} nextNumber={course.sessions.length + 1} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
