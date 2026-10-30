import type { Metadata } from "next";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { formatDateTimeZurich, formatDateZurich } from "@/lib/time";
import { requireWeapons } from "@/modules/weapons/guard";
import { defaultMinorReportDays, loansOverview, memberOptions, type LoanRow } from "@/modules/weapons/queries";
import { listAvailableWeapons } from "@/modules/weapons/service";
import { MINOR_HINT, RESPONSIBILITY_HINT } from "@/modules/weapons/types";
import { LendButton } from "@/modules/weapons/ui/lend-dialog";
import { ReportButton, ReturnButton } from "@/modules/weapons/ui/loan-actions";

export const metadata: Metadata = { title: "Ausleihen" };

const day = (d: Date) => formatDateZurich(d, { weekday: undefined });

export default async function LoansPage() {
  const ctx = await requireWeapons();
  const canManage = ctx.can("weapons.manage");
  const tenantId = ctx.tenant.id;
  const [{ open, minors, recent }, available, members, reportDays] = await Promise.all([
    loansOverview(tenantId),
    listAvailableWeapons(tenantId),
    memberOptions(tenantId),
    defaultMinorReportDays(tenantId),
  ]);
  const overdue = open.filter((l) => l.overdue).length;
  const minorOpen = minors.filter((l) => l.report.state !== "reported");
  const minorDone = minors.filter((l) => l.report.state === "reported");

  return (
    <div>
      <PageHeader title="Ausleihen" subtitle={`${open.length} offen${overdue ? ` · ${overdue} überfällig` : ""}`} back={{ href: "/weapons", label: "Vereinswaffen" }}
        action={<LendButton weapons={available.map((w) => ({ id: w.id, name: w.name }))} members={members} defaultReportDays={reportDays} />} />

      <SectionTitle>Offene Ausleihen</SectionTitle>
      {open.length === 0 ? (
        <EmptyState title="Alle Waffen sind zurück" text="Zurzeit ist keine Vereinswaffe ausgeliehen." className="mb-4" />
      ) : (
        <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
          {open.map((l) => <OpenLoan key={l.id} l={l} canManage={canManage} />)}
        </Card>
      )}

      <section id="minors" className="scroll-mt-20">
        <SectionTitle>Abgaben an Minderjährige</SectionTitle>
        <Alert tone="warn" className="mb-3">{MINOR_HINT}</Alert>
        {minorOpen.length === 0 ? (
          <p className="mb-4 text-sm text-ink-3">Keine offenen Meldungen.</p>
        ) : (
          <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
            {minorOpen.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    {l.borrower}
                    <ReportBadge l={l} />
                  </div>
                  <div className="text-xs text-ink-3">
                    <Link href={`/weapons/${l.weaponId}`} className="underline-offset-2 hover:underline">{l.weaponName}</Link> · ausgegeben {day(l.loanedAt)}
                    {l.reportDueAt ? ` · Meldung bis ${day(l.reportDueAt)}` : ""}
                  </div>
                </div>
                <ReportButton loanId={l.id} reported={false} canUndo={canManage} />
              </div>
            ))}
          </Card>
        )}
        {minorDone.length ? (
          <details className="mb-4">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm text-ink-2">Gemeldet (letzte 90 Tage): {minorDone.length}</summary>
            <Card className="mt-2 divide-y divide-line overflow-hidden">
              {minorDone.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{l.borrower}</span> · {l.weaponName}
                    <div className="text-xs text-ink-3">gemeldet {l.reportedAt ? day(l.reportedAt) : ""}</div>
                  </div>
                  <ReportButton loanId={l.id} reported canUndo={canManage} />
                </div>
              ))}
            </Card>
          </details>
        ) : null}
      </section>

      <SectionTitle>Zuletzt zurückgegeben</SectionTitle>
      {recent.length === 0 ? (
        <p className="mb-4 text-sm text-ink-3">Noch keine Rückgaben.</p>
      ) : (
        <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
          {recent.map((l) => (
            <div key={l.id} className="px-4 py-2.5 text-sm">
              <span className="font-medium">{l.weaponName}</span> · {l.borrower}
              <div className="text-xs text-ink-3">{formatDateTimeZurich(l.loanedAt)} – {l.returnedAt ? formatDateTimeZurich(l.returnedAt) : ""}{l.shots !== null ? ` · ${l.shots} Schuss` : ""}</div>
            </div>
          ))}
        </Card>
      )}
      {canManage ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <LinkButton href="/api/export/weapons?kind=loans" variant="ghost" size="sm" className="h-11" prefetch={false}><Download className="h-4 w-4" /> Ausleihen (CSV)</LinkButton>
          <LinkButton href="/api/export/weapons?kind=services" variant="ghost" size="sm" className="h-11" prefetch={false}><Download className="h-4 w-4" /> Wartungen (CSV)</LinkButton>
        </div>
      ) : null}
      <p className="text-xs text-ink-3">{RESPONSIBILITY_HINT}</p>
    </div>
  );
}

function ReportBadge({ l }: { l: LoanRow }) {
  const s = l.report.state;
  if (s === "overdue") return <Badge tone="danger">Frist abgelaufen</Badge>;
  if (s === "soon") return <Badge tone="warn">{l.report.daysLeft === 0 ? "heute fällig" : `noch ${l.report.daysLeft} ${l.report.daysLeft === 1 ? "Tag" : "Tage"}`}</Badge>;
  if (s === "reported") return <Badge tone="ok">gemeldet</Badge>;
  return <Badge>Meldung offen</Badge>;
}

function OpenLoan({ l, canManage }: { l: LoanRow; canManage: boolean }) {
  return (
    <div className={`space-y-2 px-4 py-3 ${l.overdue ? "bg-danger/5" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/weapons/${l.weaponId}`} className="font-medium underline-offset-2 hover:underline">{l.weaponName}</Link>
        {l.overdue ? <Badge tone="danger">überfällig</Badge> : null}
        {l.isMinor ? <ReportBadge l={l} /> : null}
        {l.onSiteOnly ? <Badge tone="outline">nur am Stand</Badge> : null}
      </div>
      <div className="text-sm">{l.borrower}</div>
      <div className="text-xs text-ink-3">
        seit {formatDateTimeZurich(l.loanedAt)}{l.dueAt ? ` · zurück bis ${day(l.dueAt)}` : ""}{l.issuedByName ? ` · ausgegeben von ${l.issuedByName}` : ""}{l.note ? ` · ${l.note}` : ""}
      </div>
      <div className="flex flex-wrap gap-2">
        <ReturnButton loanId={l.id} label={`${l.weaponName} · ${l.borrower}`} />
        <LinkButton href={`/weapons/loans/${l.id}/receipt`} variant="secondary" target="_blank" aria-label="Quittung drucken"><Printer className="h-4 w-4" /> Quittung</LinkButton>
        {l.isMinor && l.report.state !== "reported" ? <ReportButton loanId={l.id} reported={false} canUndo={canManage} size="md" /> : null}
      </div>
    </div>
  );
}
