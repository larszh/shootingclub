import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, ChevronRight, GraduationCap, Plus } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, LinkTabs, PageHeader, SectionTitle } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireCourses } from "@/modules/courses/guard";
import { chDate } from "@/modules/courses/logic";
import { courseYears, listCourses, myCourseParticipations, type CourseListItem } from "@/modules/courses/queries";
import { COURSE_KIND, COURSE_KINDS, courseStatusInfo, isCourseKind } from "@/modules/courses/types";
import { MyCourseCard } from "@/modules/courses/ui/my-course";

export const metadata: Metadata = { title: "Kurse" };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ year?: string; kind?: string; denied?: string }> }) {
  const ctx = await requireCourses();
  const sp = await searchParams;
  const canManage = ctx.can("courses.manage");
  const canQual = canManage || ctx.can("qualifications.manage");
  const tenantId = ctx.tenant.id;
  const thisYear = Number(todayZurich().slice(0, 4));
  const mine = await myCourseParticipations(tenantId, ctx.user.id);

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Kurse" subtitle="Deine Kurse und dein Stand" action={canQual ? <LinkButton href="/courses/qualifications" variant="secondary"><BadgeCheck className="h-4 w-4" /> Qualifikationen</LinkButton> : undefined} />
        {sp.denied ? <Alert className="mb-4">Dafür fehlt dir die Berechtigung (Kursleitung).</Alert> : null}
        {mine.length ? (
          <div className="space-y-3">{mine.map((m) => <MyCourseCard key={m.me.id} course={m.course} me={m.me} />)}</div>
        ) : (
          <EmptyState icon={<GraduationCap className="h-5 w-5" />} title="Du bist in keinem Kurs eingetragen" text="Die Kursleitung trägt dich ein. Danach siehst du hier Präsenz und Pflichtprogramme." />
        )}
      </div>
    );
  }

  const years = [...new Set([thisYear + 1, thisYear, ...(await courseYears(tenantId))])].sort((a, b) => b - a);
  const year = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : thisYear;
  const kind = isCourseKind(sp.kind) ? sp.kind : undefined;
  const courses = await listCourses(tenantId, { year, kind });
  const qs = (y: number, k?: string) => {
    const p = new URLSearchParams();
    if (y !== thisYear) p.set("year", String(y));
    if (k) p.set("kind", k);
    return `/courses${p.size ? `?${p}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Kurse"
        subtitle="Jungschützen, J+S, Ausbildung und Qualifikationsschiessen"
        action={<LinkButton href="/courses/new" size="md"><Plus className="h-4 w-4" /> Kurs</LinkButton>}
      />
      {sp.denied ? <Alert className="mb-4">Dafür fehlt dir die Berechtigung.</Alert> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <LinkButton href="/courses/qualifications" variant="secondary"><BadgeCheck className="h-4 w-4" /> Qualifikationsschiessen</LinkButton>
      </div>

      <LinkTabs label="Jahr wählen" className="mb-2" active={String(year)} items={years.map((y) => ({ value: String(y), label: String(y), href: qs(y, kind) }))} />
      <LinkTabs
        label="Kursart wählen"
        className="mb-4"
        active={kind ?? "all"}
        items={[{ value: "all", label: "Alle", href: qs(year) }, ...COURSE_KINDS.map((k) => ({ value: k, label: COURSE_KIND[k].short, href: qs(year, k) }))]}
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-5 w-5" />}
          title={`Keine Kurse ${year}`}
          text="Lege einen Kurs an, trage Teilnehmende ein und führe Präsenz und Resultate direkt am Stand."
          action={<LinkButton href="/courses/new"><Plus className="h-4 w-4" /> Kurs erstellen</LinkButton>}
        />
      ) : (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {courses.map((c) => <CourseRow key={c.id} c={c} />)}
        </Card>
      )}

      {mine.length ? (
        <div className="mt-6">
          <SectionTitle>Meine Teilnahmen</SectionTitle>
          <div className="space-y-3">{mine.map((m) => <MyCourseCard key={m.me.id} course={m.course} me={m.me} />)}</div>
        </div>
      ) : null}
    </div>
  );
}

function CourseRow({ c }: { c: CourseListItem }) {
  const st = courseStatusInfo(c.status);
  const tooFew = c.minParticipants != null && c.participants < c.minParticipants && c.status !== "CLOSED";
  const dates = [chDate(c.startsOn), chDate(c.endsOn)].filter(Boolean).join(" – ");
  return (
    <Link href={`/courses/${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{c.name}</span>
          <Badge tone="accent">{isCourseKind(c.kind) ? COURSE_KIND[c.kind].short : c.kind}</Badge>
          <Badge tone={st.tone}>{st.label}</Badge>
          {tooFew ? <Badge tone="warn"><AlertTriangle className="mr-1 h-3 w-3" /> zu wenige</Badge> : null}
        </div>
        <div className="truncate text-xs text-ink-3">
          {[dates, c.leaderName ? `Leitung: ${c.leaderName}` : null].filter(Boolean).join(" · ") || "Noch ohne Daten"}
        </div>
        <div className="text-xs text-ink-3">
          {c.participants} Teilnehmende{c.minParticipants != null ? ` (min. ${c.minParticipants})` : ""} · {c.sessions} Lektionen
          {c.requiredCount ? ` · ${c.requiredCount} Pflichtprogramme` : ""}{c.completed ? ` · ${c.completed} abgeschlossen` : ""}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
    </Link>
  );
}
