import Link from "next/link";
import { CheckCircle2, Circle, Printer, XCircle } from "lucide-react";
import { Badge, Card, LinkButton, ProgressBar } from "@/components/ui";
import { chDate } from "@/modules/courses/logic";
import type { CourseDetail } from "@/modules/courses/queries";
import { courseKindLabel, participantStatusInfo } from "@/modules/courses/types";

type Me = CourseDetail["participants"][number];

export function CellIcon({ state, className = "h-5 w-5" }: { state: "passed" | "failed" | "open"; className?: string }) {
  if (state === "passed") return <CheckCircle2 className={`${className} text-ok`} aria-label="bestanden" />;
  if (state === "failed") return <XCircle className={`${className} text-danger`} aria-label="nicht bestanden" />;
  return <Circle className={`${className} text-ink-3`} aria-label="offen" />;
}

/** Eigener Kursstand für Teilnehmende mit Konto: Präsenz und Pflichtprogramme. */
export function MyCourseCard({ course, me, link = true }: { course: CourseDetail; me: Me; link?: boolean }) {
  const st = participantStatusInfo(me.status);
  const dates = [chDate(course.startsOnDay), chDate(course.endsOnDay)].filter(Boolean).join(" – ");
  const title = link ? <Link href={`/courses/${course.id}`} className="font-semibold hover:underline">{course.name}</Link> : <span className="font-semibold">{course.name}</span>;
  return (
    <Card className="animate-rise space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {title}
          <div className="text-xs text-ink-3">{[courseKindLabel(course.kind), dates, course.leaderName ? `Leitung: ${course.leaderName}` : null].filter(Boolean).join(" · ")}</div>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      {me.attendance.total > 0 ? (
        <div>
          <ProgressBar value={me.attendance.present} max={me.attendance.total} label="Präsenz" tone="ok" size="sm" />
          <div className="mt-1 text-xs text-ink-3">{me.attendance.present} von {me.attendance.total} Lektionen anwesend</div>
        </div>
      ) : null}
      {course.requiredPrograms.length ? (
        <ul className="space-y-1.5">
          {course.requiredPrograms.map((p) => {
            const cell = me.completion.cells[p.id]!;
            return (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <CellIcon state={cell.state} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {cell.best?.score != null ? <span className="tabular-nums text-ink-3">{cell.best.score}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {me.weapon ? <div className="text-xs text-ink-3">Zugeteilte Vereinswaffe: {me.weapon.name}</div> : null}
      {me.status === "COMPLETED" && me.completion.allPassed ? (
        <LinkButton href={`/courses/${course.id}/certificate`} variant="secondary" size="md" className="w-full sm:w-auto" prefetch={false}>
          <Printer className="h-4 w-4" /> Kursausweis
        </LinkButton>
      ) : null}
    </Card>
  );
}
