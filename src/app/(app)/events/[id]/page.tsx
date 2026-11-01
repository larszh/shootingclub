import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Ban, CalendarPlus, ChevronRight, CircleHelp, Clock, GraduationCap, HandHelping, MapPin, UserRound, X } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/tenant";
import { zurichParts } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Alert, Card, PageHeader, SectionTitle, buttonClasses } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { getEventDetail, type Attendee } from "@/modules/events/queries";
import { getRequestLocale, getT, type TFunction } from "@/lib/i18n";
import { deadlineLabelL, longDateL, rsvpLabel, whenLabelL } from "@/modules/events/ui/i18n";
import { tPlural } from "@/modules/billing/ui/i18n";
import { DateBadge, KindChip, RichText } from "@/modules/events/ui/bits";
import { RsvpPanel } from "@/modules/events/ui/rsvp-panel";
import { ShareButton } from "@/modules/events/ui/share-button";
import { EventManageBar } from "@/modules/events/ui/manage-actions";
import { canSelfSignUp, staffing } from "@/modules/shifts/logic";
import { nowDate } from "@/modules/billing/dates";
import { courseSessionForEvent } from "@/modules/courses/queries";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("money.events.metaDetail") };
}

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ saved?: string; created?: string }>;

function AttendeeRow({ a, showNote, t }: { a: Attendee; showNote: boolean; t: TFunction }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar name={a.name} src={a.avatarUrl} size={36} tone="soft" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{a.name}{a.guests > 0 ? <span className="font-normal text-ink-3"> + {tPlural(t, "money.events.detail.companions", a.guests)}</span> : null}</p>
        {showNote && a.note ? <p className="truncate text-xs text-ink-3">«{a.note}»</p> : null}
      </div>
    </li>
  );
}

export default async function EventDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const ctx = await requireModule("events");
  const { id } = await params;
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const d = await getEventDetail(ctx, id);
  if (!d) notFound();
  const { event: e, counts, attendees, isManager } = d;
  const yes = attendees.filter((a) => a.status === "YES");
  const maybe = attendees.filter((a) => a.status === "MAYBE");
  const no = attendees.filter((a) => a.status === "NO");
  const when = whenLabelL(e, locale);
  const shareText = [e.title, `${longDateL(e.startsAt, locale)} · ${when}`, e.location].filter(Boolean).join("\n");
  const pct = e.capacity ? Math.min(100, Math.round((d.seatsTaken / e.capacity) * 100)) : 0;
  // Querverweise auf Welle-B-Module (nur wenn aktiv): Obligatorisch → Bundesübungen, Schichten → Helfer.
  const federalLink = e.kind === "OBLIGATORY" && ctx.hasModule("federal");
  const shifts = ctx.hasModule("shifts") && !e.isCancelled && !d.isPast
    ? await db.shift.findMany({ where: { tenantId: ctx.tenant.id, eventId: e.id }, select: { startsAt: true, capacity: true, assignments: { select: { status: true } } }, take: 50 })
    : [];
  // Kurse → Kurslektion zum Anlass (Präsenz erfassen), nur für Kursverantwortliche.
  const courseSession = ctx.hasModule("courses") && ctx.can("courses.manage") ? await courseSessionForEvent(ctx.tenant.id, e.id) : null;
  // Gleiche Regeln wie unter /shifts: NO_SHOW belegt keinen Platz, begonnene Schichten sind nicht mehr buchbar.
  const now = nowDate();
  const openSlots = shifts.reduce((a, s) => {
    const st = staffing(s.capacity, s.assignments);
    return a + (canSelfSignUp(s, st, now) ? st.open : 0);
  }, 0);

  return (
    <div>
      <PageHeader title={e.title} back={{ href: "/events", label: t("money.events.title") }} />

      {sp.created ? <div className="mb-4"><Alert tone="ok">{t("money.events.detail.created")}</Alert></div> : sp.saved ? <div className="mb-4"><Alert tone="ok">{t("money.events.detail.saved")}</Alert></div> : null}

      {e.isCancelled ? (
        <div className="animate-pop mb-4 flex items-start gap-3 rounded-card bg-accent px-4 py-3 text-accent-ink">
          <Ban className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-semibold">{t("money.events.detail.cancelledTitle")}</p><p className="text-sm opacity-90">{t("money.events.detail.cancelledText")}</p></div>
        </div>
      ) : null}

      <Card className="animate-rise p-4">
        <div className="flex gap-4">
          <DateBadge date={e.startsAt} size="lg" muted={e.isCancelled || d.isPast} locale={locale} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <KindChip kind={e.kind} locale={locale} />
            <p className="font-medium leading-snug">{longDateL(e.startsAt, locale)}</p>
            <p className="flex items-center gap-1.5 text-sm text-ink-2"><Clock className="h-4 w-4 shrink-0 text-ink-3" />{when}</p>
            {e.location ? (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}`} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-1.5 text-sm text-ink-2 underline-offset-2 hover:underline">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" /><span className="break-words">{e.location}</span>
              </a>
            ) : null}
          </div>
        </div>
        {e.description ? <RichText text={e.description} className="mt-4 border-t border-line pt-4 text-[15px] leading-relaxed text-ink-2" /> : null}
        {e.createdBy ? <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-3"><UserRound className="h-3.5 w-3.5" /> {t("money.events.detail.createdBy", { name: e.createdBy.name })}</p> : null}
      </Card>

      <div className="mt-3 flex gap-2">
        <a href={`/api/ical/event/${e.id}`} className={buttonClasses("secondary", "md", "flex-1")} download><CalendarPlus className="h-4 w-4" /> {t("money.events.detail.toCalendar")}</a>
        <ShareButton title={e.title} text={shareText} path={`/events/${e.id}`} locale={locale} />
      </div>

      {federalLink || shifts.length || courseSession ? (
        <Card className="animate-rise mt-3 divide-y divide-line overflow-hidden">
          {federalLink ? (
            <Link href={`/federal?year=${zurichParts(e.startsAt).dateStr.slice(0, 4)}`} className="flex min-h-13 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2">
              <BadgeCheck className="h-5 w-5 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block font-medium">{t("money.events.detail.federal")}</span><span className="block text-xs text-ink-3">{t("money.events.detail.federalText")}</span></span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
            </Link>
          ) : null}
          {shifts.length ? (
            <Link href="/shifts" className="flex min-h-13 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2">
              <HandHelping className={cn("h-5 w-5 shrink-0", openSlots ? "text-warn" : "text-ok")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{openSlots ? t("money.events.detail.helpersWanted") : t("money.events.detail.helperShifts")}</span>
                <span className="block text-xs text-ink-3">{openSlots ? tPlural(t, "money.events.detail.slotsFree", openSlots) : t("money.events.detail.noSlots")}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
            </Link>
          ) : null}
          {courseSession ? (
            <Link href={`/courses/${courseSession.courseId}/sessions/${courseSession.id}`} className="flex min-h-13 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2">
              <GraduationCap className="h-5 w-5 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t("money.events.detail.course")}</span>
                <span className="block truncate text-xs text-ink-3">{courseSession.course.name}{courseSession.title ? ` · ${courseSession.title}` : ""}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
            </Link>
          ) : null}
        </Card>
      ) : null}

      {e.rsvpEnabled ? (
        <>
          <SectionTitle>{t("money.events.detail.registration")}</SectionTitle>
          <RsvpPanel
            eventId={e.id}
            open={d.window.open}
            closedReason={d.window.reason}
            mine={d.mine ? { status: d.mine.status, guests: d.mine.guests, note: d.mine.note } : null}
            capacity={e.capacity}
            seatsTaken={d.seatsTaken}
            deadlineLabel={e.rsvpDeadline ? deadlineLabelL(e.rsvpDeadline, locale) : null}
            locale={locale}
          />

          <SectionTitle>{t("money.events.detail.whoComes")}</SectionTitle>
          <Card className="animate-rise p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-control bg-ok/10 py-2.5"><p className="text-xl font-semibold tabular-nums text-ok">{counts.yes + counts.yesGuests}</p><p className="text-xs text-ink-3">{t("money.events.detail.yesCount")}{counts.yesGuests ? t("money.events.detail.inclGuests", { n: counts.yesGuests }) : ""}</p></div>
              <div className="rounded-control bg-warn/10 py-2.5"><p className="text-xl font-semibold tabular-nums text-warn">{counts.maybe}</p><p className="text-xs text-ink-3">{rsvpLabel("MAYBE", locale)}</p></div>
              <div className="rounded-control bg-surface-2 py-2.5"><p className="text-xl font-semibold tabular-nums text-ink-2">{counts.no}</p><p className="text-xs text-ink-3">{t("money.events.detail.noCount")}</p></div>
            </div>
            {e.capacity ? (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-ink-3"><span>{t("money.events.detail.seatsTaken", { taken: d.seatsTaken, capacity: e.capacity })}</span>{d.isFull ? <span className="font-semibold text-warn">{t("money.events.full")}</span> : null}</div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", d.isFull ? "bg-warn" : "bg-ok")} style={{ width: `${pct}%` }} /></div>
                {d.isFull && counts.maybe > 0 ? <p className="mt-1.5 text-xs text-ink-3">{t("money.events.detail.waitlist", { n: counts.maybe })}</p> : null}
              </div>
            ) : null}

            {yes.length ? (
              <ul className="mt-3 divide-y divide-line border-t border-line">{yes.map((a) => <AttendeeRow key={a.userId} a={a} showNote={isManager} t={t} />)}</ul>
            ) : (
              <p className="mt-3 text-sm text-ink-3">{t("money.events.detail.noYes")}</p>
            )}

            {isManager ? (
              <>
                {maybe.length ? (
                  <div className="mt-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3"><CircleHelp className="h-3.5 w-3.5" /> {rsvpLabel("MAYBE", locale)}</p>
                    <ul className="divide-y divide-line">{maybe.map((a) => <AttendeeRow key={a.userId} a={a} showNote t={t} />)}</ul>
                  </div>
                ) : null}
                {no.length ? (
                  <div className="mt-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3"><X className="h-3.5 w-3.5" /> {t("money.events.rsvpMy.NO")}</p>
                    <ul className="divide-y divide-line">{no.map((a) => <AttendeeRow key={a.userId} a={a} showNote t={t} />)}</ul>
                  </div>
                ) : null}
                <p className="mt-4 text-xs text-ink-3">{tPlural(t, "money.events.detail.noAnswer", d.noAnswer)}</p>
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      {isManager ? (
        <>
          <SectionTitle>{t("money.common.manage")}</SectionTitle>
          <EventManageBar eventId={e.id} isCancelled={e.isCancelled} rsvpEnabled={e.rsvpEnabled} />
        </>
      ) : null}
    </div>
  );
}
