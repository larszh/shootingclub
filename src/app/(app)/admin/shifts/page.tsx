import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronRight, HandHelping, Plus } from "lucide-react";
import { Badge, Card, EmptyState, LinkButton, LinkTabs, PageHeader, SectionTitle } from "@/components/ui";
import { formatDateZurich, formatTimeRange } from "@/lib/time";
import { cn } from "@/lib/utils";
import { requireShiftsAdmin } from "@/modules/shifts/guard";
import { listAdminShifts, nowInstant, type AdminShiftScope, type ShiftView } from "@/modules/shifts/queries";
import { formatHours } from "@/modules/shifts/logic";
import { kindMeta } from "@/modules/events/types";
import { qualificationLabel } from "@/modules/qualifications/types";

export const metadata: Metadata = { title: "Helfereinsätze planen" };

const SCOPES: Array<{ value: AdminShiftScope; label: string }> = [
  { value: "upcoming", label: "Kommend" },
  { value: "open", label: "Unterbesetzt" },
  { value: "confirm", label: "Zu bestätigen" },
  { value: "past", label: "Vergangen" },
];

export default async function AdminShiftsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const ctx = await requireShiftsAdmin();
  const sp = await searchParams;
  const scope: AdminShiftScope = SCOPES.some((s) => s.value === sp.scope) ? (sp.scope as AdminShiftScope) : "upcoming";
  const now = nowInstant();
  const shifts = await listAdminShifts(ctx.tenant.id, scope, now);

  return (
    <div>
      <PageHeader title="Helfereinsätze" subtitle="Einsätze planen, einteilen und Stunden bestätigen" back={{ href: "/shifts", label: "Helfereinsätze" }}
        action={<LinkButton href="/admin/shifts/new"><Plus className="h-4 w-4" /> Einsatz</LinkButton>} />
      <LinkTabs active={scope} label="Einsätze filtern" className="mb-4" items={SCOPES.map((s) => ({ value: s.value, label: s.label, href: s.value === "upcoming" ? "/admin/shifts" : `/admin/shifts?scope=${s.value}` }))} />

      {shifts.length === 0 ? (
        <EmptyState icon={<HandHelping className="h-5 w-5" />}
          title={scope === "upcoming" ? "Keine Einsätze geplant" : scope === "open" ? "Alle Einsätze sind besetzt" : scope === "confirm" ? "Nichts zu bestätigen" : "Keine vergangenen Einsätze"}
          text={scope === "upcoming" ? "Erfasse Einsätze für Anlässe (Schützenfest, Obligatorisch) oder als Standdienst. Mit «Auf mehrere Daten kopieren» planst du eine ganze Saison." : undefined}
          action={scope === "upcoming" ? <LinkButton href="/admin/shifts/new"><Plus className="h-4 w-4" /> Ersten Einsatz erfassen</LinkButton> : undefined} />
      ) : (
        <ShiftList shifts={shifts} now={now} />
      )}
    </div>
  );
}

function ShiftList({ shifts, now }: { shifts: ShiftView[]; now: Date }) {
  const groups: Array<{ key: string; label: string; items: ShiftView[] }> = [];
  for (const s of shifts) {
    const key = s.day.slice(0, 7);
    const g = groups[groups.length - 1];
    if (g && g.key === key) g.items.push(s);
    else groups.push({ key, label: new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", month: "long", year: "numeric" }).format(s.startsAt), items: [s] });
  }
  return (
    <div>
      {groups.map((g) => (
        <section key={g.key}>
          <SectionTitle>{g.label}</SectionTitle>
          <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
            {g.items.map((s) => {
              const open = s.assignments.filter((a) => a.status === "ASSIGNED").length;
              const started = s.startsAt <= now;
              const meta = s.event ? kindMeta(s.event.kind) : null;
              return (
                <Link key={s.id} href={`/admin/shifts/${s.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <div className="w-12 shrink-0 text-center">
                    <div className="text-xs uppercase text-ink-3">{formatDateZurich(s.startsAt, { weekday: "short", day: undefined, month: undefined, year: undefined })}</div>
                    <div className="text-lg font-semibold tabular-nums leading-tight">{formatDateZurich(s.startsAt, { weekday: undefined, day: "numeric", month: undefined, year: undefined })}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{s.title}</span>
                      {s.event?.isCancelled ? <Badge tone="danger">Anlass abgesagt</Badge> : null}
                      {!started && s.staffing.understaffed ? <Badge tone="warn">{s.staffing.open} fehlen</Badge> : null}
                      {s.qualificationMissing ? <Badge tone="warn"><AlertTriangle className="mr-1 h-3 w-3" /> {qualificationLabel(s.requiredQualification)}</Badge> : null}
                      {started && open ? <Badge tone="accent">{open} zu bestätigen</Badge> : null}
                    </div>
                    <div className="truncate text-xs text-ink-3">
                      {formatTimeRange(s.startsAt, s.endsAt)} Uhr · {formatHours(s.defaultHours)} h · {s.staffing.filled}/{s.staffing.capacity} Personen
                      {s.event ? <> · <span className={cn("rounded-full px-1.5", meta?.chip)}>{meta?.label}</span> {s.event.title}</> : " · Standdienst"}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
                </Link>
              );
            })}
          </Card>
        </section>
      ))}
    </div>
  );
}
