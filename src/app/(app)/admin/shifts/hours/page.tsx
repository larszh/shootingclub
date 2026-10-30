import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { Alert, Badge, Card, LinkButton, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { todayZurich } from "@/lib/time";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { requireShiftsAdmin } from "@/modules/shifts/guard";
import { currentSwissYear, hoursOverview, listPendingWorkLogs, listRecentApprovedWorkLogs, shiftMemberOptions } from "@/modules/shifts/queries";
import { formatHours } from "@/modules/shifts/logic";
import { statusLabel } from "@/modules/members/types";
import { ApproveWorkLogButtons } from "@/modules/shifts/ui/admin-buttons";
import { ErsatzPanel } from "@/modules/shifts/ui/ersatz-panel";
import { WorkLogForm } from "@/modules/shifts/ui/worklog-form";

export const metadata: Metadata = { title: "Arbeitsstunden" };

const dayFmt = (d: Date) => new Intl.DateTimeFormat("de-CH", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

export default async function ShiftHoursPage({ searchParams }: { searchParams: Promise<{ year?: string; filter?: string }> }) {
  const ctx = await requireShiftsAdmin();
  const sp = await searchParams;
  const thisYear = currentSwissYear();
  const y = Number(sp.year);
  const year = Number.isInteger(y) && y >= thisYear - 10 && y <= thisYear + 1 ? y : thisYear;
  const onlyMissing = sp.filter === "missing";
  const tenantId = ctx.tenant.id;
  const [{ settings, rows }, pending, approved, members, profile] = await Promise.all([
    hoursOverview(tenantId, year),
    listPendingWorkLogs(tenantId),
    listRecentApprovedWorkLogs(tenantId, year),
    shiftMemberOptions(tenantId),
    db.billingProfile.findUnique({ where: { tenantId }, select: { payeeName: true, iban: true } }),
  ]);
  const subject = rows.filter((r) => r.subject);
  const shown = onlyMissing ? rows.filter((r) => r.missing > 0) : rows;
  const totalDone = rows.reduce((s, r) => s + r.total, 0);
  const missingSum = subject.reduce((s, r) => s + r.missing, 0);
  const candidates = subject.filter((r) => r.amountCents > 0 && !r.invoice).map((r) => ({ userId: r.userId, name: r.name, done: r.total, missing: r.missing, amountCents: r.amountCents }));
  const billed = rows.filter((r) => r.invoice);
  const blocker = !ctx.hasModule("billing")
    ? "Bitte zuerst das Modul «Mitgliederbeiträge» aktivieren (Einstellungen → Module). Die Rechnungen erscheinen dort und bei den Mitgliedern unter «Zahlungen»."
    : !profile?.payeeName || !profile.iban ? "Bitte zuerst das Rechnungsprofil (Zahlungsempfänger und IBAN) ausfüllen." : null;
  const yearHref = (v: number) => `/admin/shifts/hours?year=${v}${onlyMissing ? "&filter=missing" : ""}`;

  return (
    <div>
      <PageHeader title={`Arbeitsstunden ${year}`} subtitle="Geleistete Einsätze und bewilligte Rapporte pro Mitglied" back={{ href: "/admin/shifts", label: "Einsätze" }}
        action={<LinkButton href={`/admin/shifts/hours/export?year=${year}`} variant="secondary" prefetch={false}><Download className="h-4 w-4" /> CSV</LinkButton>} />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {[thisYear - 2, thisYear - 1, thisYear].map((v) => (
          <Link key={v} href={yearHref(v)} aria-current={v === year ? "page" : undefined}
            className={cn("press inline-flex h-11 items-center rounded-full border px-4 text-sm font-medium", v === year ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>{v}</Link>
        ))}
      </div>

      {!settings.enabled ? (
        <Alert tone="info" className="mb-4">Die Arbeitsstundenpflicht ist ausgeschaltet. Stunden werden trotzdem gezählt. <Link href="/admin/shifts/settings" className="underline">Einstellungen</Link></Alert>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Geleistet total" value={`${formatHours(totalDone)} h`} />
        <StatCard label="Pflichtig" value={subject.length} hint={settings.enabled ? `Soll ${formatHours(settings.requiredHours)} h` : "ausgeschaltet"} />
        <StatCard label="Fehlende Stunden" value={`${formatHours(missingSum)} h`} tone={missingSum ? "warn" : "ok"} />
        <StatCard label="Rapporte offen" value={pending.length} tone={pending.length ? "warn" : "neutral"} />
      </div>

      {pending.length ? (
        <>
          <SectionTitle>Zu bewilligen</SectionTitle>
          <Card className="animate-rise mb-2 divide-y divide-line overflow-hidden">
            {pending.map((l) => (
              <div key={l.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{l.user.name} · {formatHours(l.hours)} h</div>
                  <div className="text-sm text-ink-2">{l.description}</div>
                  <div className="text-xs text-ink-3">{dayFmt(l.date)}</div>
                </div>
                <ApproveWorkLogButtons id={l.id} name={l.user.name} />
              </div>
            ))}
          </Card>
        </>
      ) : null}
      <div className="mb-2 mt-4">
        <WorkLogForm today={todayZurich()} members={members.map((m) => ({ userId: m.userId, name: m.name }))} />
      </div>

      <SectionTitle action={<Link href={onlyMissing ? `/admin/shifts/hours?year=${year}` : `/admin/shifts/hours?year=${year}&filter=missing`} className="text-sm text-accent">{onlyMissing ? "Alle zeigen" : "Nur mit Fehlstunden"}</Link>}>Pro Mitglied</SectionTitle>
      <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
        {shown.length === 0 ? <p className="p-4 text-sm text-ink-3">Keine Einträge.</p> : null}
        {shown.map((r) => (
          <div key={r.membershipId} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{r.name}</span>
                {r.exempt ? <Badge tone="outline">befreit</Badge> : !r.subject ? <Badge tone="outline">{statusLabel(r.status)}</Badge> : null}
                {r.invoice ? <Badge tone={r.invoice.status === "PAID" ? "ok" : "accent"}>{r.invoice.number}{r.invoice.status === "PAID" ? " bezahlt" : ""}</Badge> : null}
              </div>
              <div className="text-xs text-ink-3">
                Einsätze {formatHours(r.shiftHours)} h · Rapporte {formatHours(r.logHours)} h{r.pendingLogHours ? ` (+${formatHours(r.pendingLogHours)} h offen)` : ""}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold tabular-nums">{formatHours(r.total)}{r.subject ? ` / ${formatHours(r.required)}` : ""} h</div>
              {r.missing ? <div className="text-xs tabular-nums text-warn">−{formatHours(r.missing)} h{r.amountCents ? ` · ${formatMoney(r.amountCents)}` : ""}</div> : null}
            </div>
          </div>
        ))}
      </Card>

      {settings.enabled && settings.ratePerMissingHourCents > 0 ? (
        <>
          <SectionTitle>Ersatzabgabe</SectionTitle>
          <p className="mb-3 text-sm text-ink-3">
            Pro Mitglied mit fehlenden Stunden eine Rechnung «Ersatzabgabe Arbeitsstunden {year} (x h)» mit QR-Zahlteil, Ansatz {formatMoney(settings.ratePerMissingHourCents)} pro Stunde.
            Am besten erst nach Jahresende und nachdem alle Einsätze bestätigt sind. Ansatz und Soll bitte mit dem Vereinsbeschluss abgleichen.
            {billed.length ? ` Bereits verrechnet: ${billed.length}.` : ""}
          </p>
          <ErsatzPanel year={year} candidates={candidates} blocker={blocker} />
        </>
      ) : null}

      {approved.length ? (
        <>
          <SectionTitle>Zuletzt bewilligte Rapporte</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {approved.map((l) => (
              <div key={l.id} className="flex min-h-12 items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm"><span className="font-medium">{l.user.name}</span> · {l.description}</div>
                  <div className="text-xs text-ink-3">{dayFmt(l.date)}</div>
                </div>
                <span className="shrink-0 text-sm tabular-nums">{formatHours(l.hours)} h</span>
              </div>
            ))}
          </Card>
        </>
      ) : null}
    </div>
  );
}
