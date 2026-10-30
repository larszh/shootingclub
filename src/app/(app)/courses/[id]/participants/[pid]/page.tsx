import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GraduationCap, IdCard, Link2, Trash2, Undo2 } from "lucide-react";
import { Alert, Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { formatDateZurich, todayZurich } from "@/lib/time";
import { completeParticipantAction, deleteParticipantAction, deleteResultAction, setParticipantStatusAction } from "@/modules/courses/actions";
import { requireCoursesManage } from "@/modules/courses/guard";
import { ageOn, canComplete, chDate, courseReferenceDay, dbDay, evaluatePass, guardianProblem } from "@/modules/courses/logic";
import { candidateMatches, getCourse, memberOptions } from "@/modules/courses/queries";
import { participantStatusInfo } from "@/modules/courses/types";
import { CellIcon } from "@/modules/courses/ui/my-course";
import { NavActionButton } from "@/modules/courses/ui/nav-action-button";
import { ParticipantForm } from "@/modules/courses/ui/participant-form";
import { LinkMatchList, ManualResultForm, type MatchCandidate } from "@/modules/courses/ui/result-forms";
import { listAvailableWeapons } from "@/modules/weapons/service";

export const metadata: Metadata = { title: "Teilnehmer:in" };

export default async function ParticipantPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const ctx = await requireCoursesManage();
  const { id, pid } = await params;
  const course = await getCourse(ctx.tenant.id, id.slice(0, 40));
  if (!course) notFound();
  const p = course.participants.find((x) => x.id === pid);
  if (!p) notFound();
  const today = todayZurich();
  const refDay = courseReferenceDay(course.startsOnDay, today);
  const weaponsEnabled = ctx.hasModule("weapons");
  const progIds = course.requiredPrograms.map((x) => x.id);
  const [members, weapons, candidates] = await Promise.all([
    memberOptions(ctx.tenant.id),
    weaponsEnabled ? listAvailableWeapons(ctx.tenant.id) : Promise.resolve([]),
    p.userId ? candidateMatches(ctx.tenant.id, p.userId, progIds) : Promise.resolve([]),
  ]);
  const st = participantStatusInfo(p.status);
  const age = ageOn(p.birthDay, refDay);
  const gp = guardianProblem({ birthDate: p.birthDay, guardianName: p.guardianName, guardianEmail: p.guardianEmail, guardianPhone: p.guardianPhone }, refDay);
  const linked = new Set(p.results.map((r) => r.matchParticipantId).filter(Boolean));
  const progById = new Map(course.requiredPrograms.map((x) => [x.id, x]));
  const candidateRows: MatchCandidate[] = candidates.map((c) => {
    const prog = progById.get(c.programId);
    const suggested = evaluatePass({ minScore: prog?.passMinScore ?? null, maxZeros: prog?.passMaxZeros ?? null }, c.total, c.zeros) ?? c.passed ?? false;
    return { id: c.id, programName: prog?.name ?? "Programm", dateLabel: formatDateZurich(c.date), total: c.total, zeros: c.zeros, suggestedPassed: suggested, officialHint: c.isOfficial ? "amtlich" : null, linked: linked.has(c.id) };
  });
  const otherResults = p.results.filter((r) => !r.programId || !progById.has(r.programId));
  const base = `/courses/${course.id}`;
  const completable = canComplete(p.completion, p.status);

  const resultLine = (r: (typeof p.results)[number], label?: string) => (
    <li key={r.id} className="flex items-center gap-2 py-1.5 text-sm">
      <span className="min-w-0 flex-1">
        {label ? <span className="font-medium">{label} · </span> : null}{chDate(dbDay(r.date))} · {r.score ?? "–"} Punkte · {r.passed ? <span className="text-ok">bestanden</span> : <span className="text-danger">nicht bestanden</span>}
        {r.matchParticipantId ? <Link2 className="ml-1 inline h-3.5 w-3.5 text-ink-3" aria-label="aus Durchgang" /> : null}
      </span>
      <ActionButton variant="ghost" size="sm" className="h-11 w-11 px-0" aria-label="Resultat löschen" action={deleteResultAction.bind(null, r.id)} confirm={{ title: "Resultat löschen?", tone: "danger", confirmLabel: "Löschen" }}>
        <Trash2 className="h-4 w-4" />
      </ActionButton>
    </li>
  );

  return (
    <div className="max-w-2xl">
      <PageHeader title={`${p.firstName} ${p.lastName}`} subtitle={[course.name, age !== null ? `${age} Jahre` : null, p.userId ? "Mitglied" : "extern"].filter(Boolean).join(" · ")} back={{ href: base, label: "Kurs" }} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={st.tone}>{st.label}</Badge>
        {p.status === "REGISTERED" ? <ActionButton size="sm" variant="secondary" action={setParticipantStatusAction.bind(null, p.id, "ACTIVE")}>Als aktiv markieren</ActionButton> : null}
        {p.status === "COMPLETED" ? (
          <>
            <LinkButton href={`${base}/certificate?p=${p.id}`} size="sm" variant="secondary" prefetch={false}><IdCard className="h-4 w-4" /> Kursausweis</LinkButton>
            <ActionButton size="sm" variant="ghost" action={setParticipantStatusAction.bind(null, p.id, "ACTIVE")} confirm={{ title: "Abschluss zurücknehmen?", confirmLabel: "Zurücknehmen" }}><Undo2 className="h-4 w-4" /> Abschluss zurücknehmen</ActionButton>
          </>
        ) : null}
      </div>

      {gp ? <Alert tone="warn" className="mb-4">{gp}</Alert> : null}

      <Card className="mb-4 space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Pflichtprogramme</h2>
          <span className="text-sm text-ink-3">{p.completion.passedCount} von {p.completion.required} bestanden</span>
        </div>
        {course.requiredPrograms.length === 0 ? <p className="text-sm text-ink-3">Für diesen Kurs sind keine Pflichtprogramme festgelegt.</p> : null}
        {course.requiredPrograms.map((prog) => {
          const cell = p.completion.cells[prog.id]!;
          const list = p.results.filter((r) => r.programId === prog.id);
          return (
            <div key={prog.id} className="rounded-control border border-line p-3">
              <div className="flex items-center gap-2">
                <CellIcon state={cell.state} />
                <span className="flex-1 font-medium">{prog.name}</span>
                {prog.passMinScore != null ? <span className="text-xs text-ink-3">ab {prog.passMinScore}</span> : null}
              </div>
              {list.length ? <ul className="mt-1 divide-y divide-line">{list.map((r) => resultLine(r))}</ul> : null}
            </div>
          );
        })}
        {p.status !== "COMPLETED" && p.status !== "DROPPED" ? (
          <ActionButton
            className="w-full"
            size="lg"
            disabled={!completable}
            action={completeParticipantAction.bind(null, p.id)}
            confirm={{ title: "Kurs abschliessen?", message: `Bestätigt, dass ${p.firstName} ${p.lastName} den Kurs erfüllt hat. Danach kann der Kursausweis gedruckt werden.`, confirmLabel: "Abschliessen" }}
          >
            <GraduationCap className="h-5 w-5" /> Kurs abschliessen
          </ActionButton>
        ) : null}
        {!completable && p.status !== "COMPLETED" && p.status !== "DROPPED" ? <p className="text-xs text-ink-3">Möglich, sobald alle Pflichtprogramme bestanden sind.</p> : null}
      </Card>

      {otherResults.length ? (
        <Card className="mb-4 p-4">
          <h2 className="mb-1 font-semibold">Weitere Resultate</h2>
          <ul className="divide-y divide-line">{otherResults.map((r) => resultLine(r, r.label))}</ul>
        </Card>
      ) : null}

      <SectionTitle>Resultat erfassen</SectionTitle>
      <Card className="mb-4 p-4">
        <ManualResultForm participantId={p.id} programs={course.requiredPrograms} today={today} />
      </Card>

      {p.userId ? (
        <>
          <SectionTitle>Aus Durchgang übernehmen</SectionTitle>
          <Card className="mb-4 px-4 py-1">
            <LinkMatchList participantId={p.id} candidates={candidateRows} />
          </Card>
        </>
      ) : null}

      {course.sessions.length ? (
        <>
          <SectionTitle>Präsenz ({p.attendance.present}/{p.attendance.total})</SectionTitle>
          <Card className="mb-4 divide-y divide-line">
            {course.sessions.map((s) => {
              const v = course.attendanceIdx.get(`${s.id}|${p.id}`);
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="flex-1">{formatDateZurich(s.startsAt)} · {s.title}</span>
                  {v === true ? <Badge tone="ok">anwesend</Badge> : v === false ? <Badge tone="outline">abwesend</Badge> : <span className="text-xs text-ink-3">nicht erfasst</span>}
                </div>
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionTitle>Angaben</SectionTitle>
      <ParticipantForm
        courseId={course.id}
        members={members}
        weapons={weapons}
        currentWeapon={p.clubWeaponId && p.weapon ? { id: p.clubWeaponId, name: p.weapon.name } : null}
        weaponsEnabled={weaponsEnabled}
        refDay={refDay}
        takenUserIds={course.participants.map((x) => x.userId).filter((x): x is string => !!x)}
        initial={{
          id: p.id, userId: p.userId, firstName: p.firstName, lastName: p.lastName, birthDate: p.birthDay, email: p.email, phone: p.phone, street: p.street, zip: p.zip, city: p.city,
          guardianName: p.guardianName, guardianEmail: p.guardianEmail, guardianPhone: p.guardianPhone, clubWeaponId: p.clubWeaponId, status: p.status, note: p.note,
        }}
      />

      <div className="mt-6 flex justify-end">
        <NavActionButton
          to={base}
          variant="ghost"
          action={deleteParticipantAction.bind(null, p.id)}
          confirm={{ title: "Aus dem Kurs entfernen?", message: "Präsenz und Resultate dieser Person im Kurs werden gelöscht. Für einen Kursabbruch besser den Status «Ausgetreten» setzen.", tone: "danger", confirmLabel: "Entfernen" }}
        >
          <Trash2 className="h-4 w-4" /> Entfernen
        </NavActionButton>
      </div>
      <p className="mt-4 text-xs text-ink-3">Erfasst am {formatDateZurich(p.createdAt)}.</p>
    </div>
  );
}
