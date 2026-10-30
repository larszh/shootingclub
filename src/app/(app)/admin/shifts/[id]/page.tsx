import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarPlus, ShieldCheck } from "lucide-react";
import { Alert, Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { formatDateZurich, formatTimeRange, zurichParts } from "@/lib/time";
import { requireShiftsAdmin } from "@/modules/shifts/guard";
import { getShiftView, nowInstant, qualifiedUsers, shiftEventOptions, shiftMemberOptions } from "@/modules/shifts/queries";
import { addDayKey, formatHours } from "@/modules/shifts/logic";
import { ASSIGNMENT_LABELS } from "@/modules/shifts/types";
import { isValidOn, qualificationLabel } from "@/modules/qualifications/types";
import { kindMeta } from "@/modules/events/types";
import { AssignButton } from "@/modules/shifts/ui/assign-dialog";
import { AssignmentActions, ConfirmAllButton } from "@/modules/shifts/ui/assignment-actions";
import { CopyShiftButton } from "@/modules/shifts/ui/copy-dialog";
import { DeleteShiftButton } from "@/modules/shifts/ui/admin-buttons";
import { ShiftForm } from "@/modules/shifts/ui/shift-form";

export const metadata: Metadata = { title: "Einsatz" };

export default async function AdminShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireShiftsAdmin();
  const { id } = await params;
  const tenantId = ctx.tenant.id;
  const s = await getShiftView(tenantId, id);
  if (!s) notFound();
  const now = nowInstant();
  const [members, events] = await Promise.all([shiftMemberOptions(tenantId), shiftEventOptions(tenantId, s.eventId)]);
  const assigned = new Set(s.assignments.map((a) => a.userId));
  const candidates = members.filter((m) => !assigned.has(m.userId));
  const quals = s.requiredQualification ? await qualifiedUsers(tenantId, s.requiredQualification, candidates.map((m) => m.userId), [s.day]) : new Map();
  const qualLabel = s.requiredQualification ? qualificationLabel(s.requiredQualification) : null;
  const started = s.startsAt <= now;
  const openCount = s.assignments.filter((a) => a.status === "ASSIGNED").length;
  const meta = s.event ? kindMeta(s.event.kind) : null;
  const start = zurichParts(s.startsAt);
  const end = zurichParts(s.endsAt);

  return (
    <div>
      <PageHeader title={s.title} subtitle={`${formatDateZurich(s.startsAt)}, ${formatTimeRange(s.startsAt, s.endsAt)} Uhr`} back={{ href: "/admin/shifts", label: "Einsätze" }} />

      <div className="mb-4 flex flex-wrap gap-2">
        {s.event ? <Badge className={meta?.chip}>{meta?.label}: {s.event.title}</Badge> : <Badge>Standdienst / eigenständig</Badge>}
        <Badge tone={s.staffing.understaffed ? "warn" : "ok"}>{s.staffing.filled}/{s.staffing.capacity} Personen</Badge>
        <Badge>{formatHours(s.defaultHours)} h pro Person</Badge>
        {qualLabel ? <Badge tone={s.qualificationMissing ? "warn" : "ok"}>{qualLabel}</Badge> : null}
      </div>
      {s.event?.isCancelled ? <Alert className="mb-4">Der Anlass ist abgesagt. Einsatz löschen oder Eingeteilte informieren.</Alert> : null}
      {s.qualificationMissing ? (
        <Alert tone="warn" className="mb-4" icon={<AlertTriangle className="h-4 w-4" />}>
          Niemand der Eingeteilten hat eine gültige Qualifikation «{qualLabel}». Bitte jemanden mit dieser Qualifikation einteilen.
        </Alert>
      ) : null}

      <SectionTitle action={<span className="text-sm text-ink-3">{s.staffing.open ? `${s.staffing.open} frei` : "voll"}</span>}>Eingeteilt</SectionTitle>
      <Card className="animate-rise mb-3 divide-y divide-line overflow-hidden">
        {s.assignments.length === 0 ? <p className="p-4 text-sm text-ink-3">Noch niemand eingeteilt. Mitglieder können sich unter «Helfereinsätze» selbst eintragen.</p> : null}
        {s.assignments.map((a) => {
          const st = ASSIGNMENT_LABELS[a.status] ?? ASSIGNMENT_LABELS.ASSIGNED!;
          return (
            <div key={a.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{a.user.name}</span>
                  <Badge tone={st.tone}>{st.label}{a.status === "DONE" ? `, ${formatHours(a.hours ?? s.defaultHours)} h` : ""}</Badge>
                  {s.requiredQualification && s.qualifiedIds.has(a.userId) ? <ShieldCheck className="h-4 w-4 text-ok" aria-label={qualLabel ?? undefined} /> : null}
                </div>
              </div>
              <AssignmentActions assignmentId={a.id} name={a.user.name} status={a.status} defaultHours={s.defaultHours} started={started} />
            </div>
          );
        })}
      </Card>
      <div className="mb-6 flex flex-wrap gap-2">
        <AssignButton shiftId={s.id} open={s.staffing.open} qualificationLabel={qualLabel}
          members={candidates.map((m) => ({ ...m, qualified: s.requiredQualification ? ((quals.get(m.userId) ?? []) as Array<{ validFrom: Date | null; validUntil: Date | null }>).some((q) => isValidOn(q, s.day)) : false }))} />
        {started && openCount ? <ConfirmAllButton shiftId={s.id} count={openCount} hours={formatHours(s.defaultHours)} /> : null}
        <a href={`/shifts/${s.id}/ics`} className="press inline-flex h-11 items-center justify-center gap-2 rounded-control px-4 text-[15px] font-medium text-ink-2 hover:bg-surface-2">
          <CalendarPlus className="h-4 w-4" /> .ics
        </a>
      </div>
      {!started ? <p className="-mt-4 mb-6 text-xs text-ink-3">Nach Beginn des Einsatzes kannst du hier «erledigt» oder «nicht erschienen» bestätigen.</p> : null}

      <SectionTitle>Vorlage</SectionTitle>
      <div className="mb-6">
        <CopyShiftButton shiftId={s.id} day={s.day} suggestTo={addDayKey(s.day, 8 * 7)} />
      </div>

      <SectionTitle>Bearbeiten</SectionTitle>
      <ShiftForm
        events={events.map((e) => ({ id: e.id, title: e.title, kind: e.kind, day: e.day, time: e.time, endTime: e.endTime, label: `${formatDateZurich(e.startsAt)} · ${e.title}` }))}
        defaultDate={s.day}
        initial={{ id: s.id, title: s.title, eventId: s.eventId, date: start.dateStr, startTime: start.timeStr, endTime: end.timeStr, capacity: s.capacity, requiredQualification: s.requiredQualification, hoursCredit: s.hoursCredit, note: s.note }}
      />
      <div className="mt-6 border-t border-line pt-4">
        <DeleteShiftButton shiftId={s.id} title={s.title} confirmed={s.assignments.filter((a) => a.status === "DONE").length} />
      </div>
    </div>
  );
}
