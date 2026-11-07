import type { Metadata } from "next";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDate, formatDateTime, type TFunction } from "@/lib/i18n/core";
import { requireWeapons } from "@/modules/weapons/guard";
import { defaultMinorReportDays, loansOverview, memberOptions, type LoanRow } from "@/modules/weapons/queries";
import { listAvailableWeapons } from "@/modules/weapons/service";
import { LendButton } from "@/modules/weapons/ui/lend-dialog";
import { ReportButton, ReturnButton } from "@/modules/weapons/ui/loan-actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.weapons.loans.title") };
}

type Fmt = { t: TFunction; day: (d: Date) => string; dt: (d: Date) => string };

export default async function LoansPage() {
  const ctx = await requireWeapons();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const day = (d: Date) => formatDate(d, locale);
  const dt = (d: Date) => formatDateTime(d, locale);
  const f: Fmt = { t, day, dt };
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
      <PageHeader title={t("adm2.weapons.loans.title")} subtitle={`${t("adm2.weapons.loans.subtitle", { n: open.length })}${overdue ? t("adm2.weapons.loans.subtitleOverdue", { n: overdue }) : ""}`} back={{ href: "/weapons", label: t("adm2.weapons.title") }}
        action={<LendButton weapons={available.map((w) => ({ id: w.id, name: w.name }))} members={members} defaultReportDays={reportDays} />} />

      <SectionTitle>{t("adm2.weapons.loans.open")}</SectionTitle>
      {open.length === 0 ? (
        <EmptyState title={t("adm2.weapons.loans.allBack")} text={t("adm2.weapons.loans.noneLent")} className="mb-4" />
      ) : (
        <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
          {open.map((l) => <OpenLoan key={l.id} l={l} canManage={canManage} f={f} />)}
        </Card>
      )}

      <section id="minors" className="scroll-mt-20">
        <SectionTitle>{t("adm2.weapons.loans.minors")}</SectionTitle>
        <Alert tone="warn" className="mb-3">{t("adm2.weapons.minorHint")}</Alert>
        {minorOpen.length === 0 ? (
          <p className="mb-4 text-sm text-ink-3">{t("adm2.weapons.loans.noOpenReports")}</p>
        ) : (
          <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
            {minorOpen.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    {l.borrower}
                    <ReportBadge l={l} t={t} />
                  </div>
                  <div className="text-xs text-ink-3">
                    <Link href={`/weapons/${l.weaponId}`} className="underline-offset-2 hover:underline">{l.weaponName}</Link>{t("adm2.weapons.loans.issuedOn", { date: day(l.loanedAt) })}
                    {l.reportDueAt ? t("adm2.weapons.loans.reportBy", { date: day(l.reportDueAt) }) : ""}
                  </div>
                </div>
                <ReportButton loanId={l.id} reported={false} canUndo={canManage} />
              </div>
            ))}
          </Card>
        )}
        {minorDone.length ? (
          <details className="mb-4">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm text-ink-2">{t("adm2.weapons.loans.reported90", { n: minorDone.length })}</summary>
            <Card className="mt-2 divide-y divide-line overflow-hidden">
              {minorDone.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{l.borrower}</span> · {l.weaponName}
                    <div className="text-xs text-ink-3">{l.reportedAt ? t("adm2.weapons.loans.reportedOn", { date: day(l.reportedAt) }) : t("adm2.weapons.loans.reported")}</div>
                  </div>
                  <ReportButton loanId={l.id} reported canUndo={canManage} />
                </div>
              ))}
            </Card>
          </details>
        ) : null}
      </section>

      <SectionTitle>{t("adm2.weapons.loans.recent")}</SectionTitle>
      {recent.length === 0 ? (
        <p className="mb-4 text-sm text-ink-3">{t("adm2.weapons.loans.noReturns")}</p>
      ) : (
        <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
          {recent.map((l) => (
            <div key={l.id} className="px-4 py-2.5 text-sm">
              <span className="font-medium">{l.weaponName}</span> · {l.borrower}
              <div className="text-xs text-ink-3">{dt(l.loanedAt)} – {l.returnedAt ? dt(l.returnedAt) : ""}{l.shots !== null ? ` · ${t("adm2.weapons.shots", { n: l.shots })}` : ""}</div>
            </div>
          ))}
        </Card>
      )}
      {canManage ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <LinkButton href="/api/export/weapons?kind=loans" variant="ghost" size="sm" className="h-11" prefetch={false}><Download className="h-4 w-4" /> {t("adm2.weapons.loans.csvLoans")}</LinkButton>
          <LinkButton href="/api/export/weapons?kind=services" variant="ghost" size="sm" className="h-11" prefetch={false}><Download className="h-4 w-4" /> {t("adm2.weapons.loans.csvServices")}</LinkButton>
        </div>
      ) : null}
      <p className="text-xs text-ink-3">{t("adm2.weapons.responsibility")}</p>
    </div>
  );
}

function ReportBadge({ l, t }: { l: LoanRow; t: TFunction }) {
  const s = l.report.state;
  if (s === "overdue") return <Badge tone="danger">{t("adm2.weapons.loans.deadlinePassed")}</Badge>;
  if (s === "soon") return <Badge tone="warn">{l.report.daysLeft === 0 ? t("adm2.weapons.loans.dueToday") : t(l.report.daysLeft === 1 ? "adm2.weapons.loans.daysLeft.one" : "adm2.weapons.loans.daysLeft.other", { n: l.report.daysLeft ?? 0 })}</Badge>;
  if (s === "reported") return <Badge tone="ok">{t("adm2.weapons.loans.reported")}</Badge>;
  return <Badge>{t("adm2.weapons.loans.reportOpen")}</Badge>;
}

function OpenLoan({ l, canManage, f }: { l: LoanRow; canManage: boolean; f: Fmt }) {
  const { t, day, dt } = f;
  return (
    <div className={`space-y-2 px-4 py-3 ${l.overdue ? "bg-danger/5" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/weapons/${l.weaponId}`} className="font-medium underline-offset-2 hover:underline">{l.weaponName}</Link>
        {l.overdue ? <Badge tone="danger">{t("adm2.weapons.overdue")}</Badge> : null}
        {l.isMinor ? <ReportBadge l={l} t={t} /> : null}
        {l.onSiteOnly ? <Badge tone="outline">{t("adm2.weapons.loans.onSite")}</Badge> : null}
      </div>
      <div className="text-sm">{l.borrower}</div>
      <div className="text-xs text-ink-3">
        {t("adm2.weapons.detail.since", { date: dt(l.loanedAt) })}{l.dueAt ? t("adm2.weapons.detail.dueBack", { date: day(l.dueAt) }) : ""}{l.issuedByName ? t("adm2.weapons.detail.issuedBy", { name: l.issuedByName }) : ""}{l.note ? ` · ${l.note}` : ""}
      </div>
      <div className="flex flex-wrap gap-2">
        <ReturnButton loanId={l.id} label={`${l.weaponName} · ${l.borrower}`} />
        <LinkButton href={`/weapons/loans/${l.id}/receipt`} variant="secondary" target="_blank" aria-label={t("adm2.weapons.lend.printReceipt")}><Printer className="h-4 w-4" /> {t("adm2.weapons.detail.receipt")}</LinkButton>
        {l.isMinor && l.report.state !== "reported" ? <ReportButton loanId={l.id} reported={false} canUndo={canManage} size="md" /> : null}
      </div>
    </div>
  );
}
