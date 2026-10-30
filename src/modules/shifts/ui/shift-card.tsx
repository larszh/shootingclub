import { AlertTriangle, CalendarPlus, Clock, MapPin, ShieldCheck, Users } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { formatDateZurich, formatTimeRange } from "@/lib/time";
import { cn } from "@/lib/utils";
import { kindMeta } from "@/modules/events/types";
import { qualificationLabel } from "@/modules/qualifications/types";
import { ASSIGNMENT_LABELS } from "../types";
import { canSelfSignUp, canSelfWithdraw, formatHours } from "../logic";
import type { ShiftView } from "../queries";
import { SignUpButton, WithdrawButton } from "./member-buttons";

/** Karte eines Einsatzes in der Mitgliederansicht: Zeit, Anlass, Besetzung, eintragen/austragen, .ics. */
export function ShiftCard({ s, userId, now, showDate = true, interactive = true }: { s: ShiftView; userId: string; now: Date; showDate?: boolean; interactive?: boolean }) {
  const mine = s.assignments.find((a) => a.userId === userId) ?? null;
  const signUp = interactive && !mine && canSelfSignUp(s, s.staffing, now);
  const withdraw = interactive && mine && canSelfWithdraw(s, mine, now);
  const meta = s.event ? kindMeta(s.event.kind) : null;
  const status = mine ? ASSIGNMENT_LABELS[mine.status] : null;
  const hours = mine?.status === "DONE" ? mine.hours ?? s.defaultHours : s.defaultHours;
  const qual = s.requiredQualification ? qualificationLabel(s.requiredQualification) : null;
  return (
    <Card className={cn("animate-rise p-4", mine && mine.status === "ASSIGNED" && "border-accent/40")}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold">{s.title}</h3>
        {status ? <Badge tone={status.tone}>{mine!.status === "ASSIGNED" ? "du bist eingeteilt" : status.label}</Badge> : null}
        {!mine && s.staffing.full ? <Badge tone="outline">voll</Badge> : null}
      </div>
      {s.event ? (
        <p className="mt-1 text-sm">
          <span className={cn("mr-1.5 inline-flex rounded-full px-2 py-0.5 text-xs font-medium", meta?.chip)}>{meta?.label}</span>
          {s.event.title}
        </p>
      ) : <p className="mt-1 text-sm text-ink-3">Standdienst / eigenständiger Einsatz</p>}
      <ul className="mt-2 space-y-1 text-sm text-ink-2">
        <li className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />{showDate ? `${formatDateZurich(s.startsAt)}, ` : ""}{formatTimeRange(s.startsAt, s.endsAt)} Uhr · {formatHours(hours)} h</li>
        {s.event?.location ? <li className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />{s.event.location}</li> : null}
        <li className="flex items-center gap-2"><Users className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />{s.staffing.filled} von {s.staffing.capacity} {s.staffing.open ? `· ${s.staffing.open} ${s.staffing.open === 1 ? "Platz" : "Plätze"} frei` : ""}</li>
        {qual ? (
          <li className={cn("flex items-center gap-2", s.qualificationMissing ? "text-warn" : "")}>
            {s.qualificationMissing ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> : <ShieldCheck className="h-4 w-4 shrink-0 text-ok" aria-hidden />}
            {s.qualificationMissing ? `Gesucht: jemand mit «${qual}»` : `«${qual}» ist abgedeckt`}
          </li>
        ) : null}
      </ul>
      {s.note ? <p className="mt-2 rounded-control bg-surface-2 px-3 py-2 text-sm text-ink-2">{s.note}</p> : null}
      {signUp || withdraw || mine ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {signUp ? <SignUpButton shiftId={s.id} title={s.title} /> : null}
          {withdraw ? <WithdrawButton shiftId={s.id} title={s.title} /> : null}
          {mine && s.endsAt > now ? (
            <a href={`/shifts/${s.id}/ics`} className="press inline-flex h-11 items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 text-[15px] font-medium text-ink hover:bg-surface-2">
              <CalendarPlus className="h-4 w-4" /> In Kalender
            </a>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
