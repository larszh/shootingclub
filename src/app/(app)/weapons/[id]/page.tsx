import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, Pencil, Printer } from "lucide-react";
import { Alert, Badge, Card, LinkButton, PageHeader, ProgressBar, SectionTitle } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { getRequestLocale, getT } from "@/lib/i18n";
import { INTL_LOCALE } from "@/lib/i18n/locales";
import { formatDate, formatDateTime, formatMoneyLocale } from "@/lib/i18n/core";
import { requireWeapons } from "@/modules/weapons/guard";
import { stripBlockReason } from "@/modules/weapons/logic";
import { defaultMinorReportDays, getWeapon, memberOptions } from "@/modules/weapons/queries";
import { DEFAULT_MINOR_REPORT_DAYS, serviceKindLabel, weaponStatusInfo } from "@/modules/weapons/types";
import { LendButton } from "@/modules/weapons/ui/lend-dialog";
import { ReportButton, ReturnButton } from "@/modules/weapons/ui/loan-actions";
import { ServiceForm } from "@/modules/weapons/ui/service-form";
import { StatusActions } from "@/modules/weapons/ui/status-actions";
import { ServiceDeleteButton } from "@/modules/weapons/ui/service-delete";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.weapons.single") };
}

export default async function WeaponDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWeapons();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const fmt = (n: number) => new Intl.NumberFormat(INTL_LOCALE[locale]).format(n);
  const day = (d: Date) => formatDate(d, locale);
  const dt = (d: Date) => formatDateTime(d, locale);
  const { id } = await params;
  const canManage = ctx.can("weapons.manage");
  const w = await getWeapon(ctx.tenant.id, id.slice(0, 40), canManage);
  if (!w) notFound();
  const st = weaponStatusInfo(w.status, t);
  const open = w.loans.find((l) => !l.returnedAt) ?? null;
  const [members, reportDays] = w.status === "AVAILABLE" ? await Promise.all([memberOptions(ctx.tenant.id), defaultMinorReportDays(ctx.tenant.id)]) : [[], DEFAULT_MINOR_REPORT_DAYS];
  const today = todayZurich();
  const sv = w.service;
  const notes = stripBlockReason(w.notes);

  return (
    <div>
      <PageHeader title={w.name} subtitle={[w.discipline, w.caliber].filter(Boolean).join(" · ") || undefined} back={{ href: "/weapons", label: t("adm2.weapons.title") }}
        action={canManage ? <LinkButton href={`/weapons/${w.id}/edit`} variant="secondary" aria-label={t("adm2.weapons.detail.edit")}><Pencil className="h-4 w-4" /><span className="hidden sm:inline">{t("adm2.weapons.detail.edit")}</span></LinkButton> : undefined} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={st.tone} className="text-sm">{st.label}</Badge>
        {sv.due && w.status !== "SERVICE" ? <Badge tone="warn" className="text-sm"><AlertTriangle className="mr-1 h-3.5 w-3.5" /> {t("adm2.weapons.list.serviceDue")}</Badge> : null}
      </div>
      {w.blockReason ? <Alert tone="error" title={t("adm2.weapons.detail.blocked")} className="mb-4">{w.blockReason}</Alert> : null}
      {sv.due ? (
        <Alert tone="warn" title={t("adm2.weapons.list.serviceDue")} className="mb-4">
          {sv.byShots ? t("adm2.weapons.detail.byShots", { every: fmt(w.serviceEveryShots ?? 0), since: fmt(w.shotsSinceService) }) : ""}
          {sv.byDate && w.nextServiceAt ? t("adm2.weapons.detail.byDate", { date: day(w.nextServiceAt) }) : ""}
          {canManage ? t("adm2.weapons.detail.dueManage") : t("adm2.weapons.detail.dueMember")}
        </Alert>
      ) : null}

      {/* Ausleihe */}
      {/* LendButton steht immer an derselben Stelle (nur der Knopf wird ausgeblendet), damit der Erfolgsdialog
          nach dem Ausleihen das Neuladen der Seite übersteht (die Seite zeigt dann die offene Ausleihe). */}
      <Card className="animate-rise mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        {open ? (
          <div className="w-full space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-3">{t("adm2.weapons.detail.loanedTo")}</div>
              <div className="text-lg font-semibold">{open.borrower}</div>
              <div className="text-sm text-ink-3">
                {t("adm2.weapons.detail.since", { date: dt(open.loanedAt) })}{open.dueAt ? t("adm2.weapons.detail.dueBack", { date: day(open.dueAt) }) : ""}{open.onSiteOnly ? t("adm2.weapons.detail.onSite") : ""}
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {open.overdue ? <Badge tone="danger">{t("adm2.weapons.overdue")}</Badge> : null}
                {open.isMinor ? <Badge tone="warn">{t("adm2.weapons.lend.minor")}</Badge> : null}
              </div>
            </div>
            {open.isMinor && open.report.state !== "reported" ? <Alert tone="warn">{t("adm2.weapons.minorHint")}{open.reportDueAt ? t("adm2.weapons.detail.reportBy", { date: day(open.reportDueAt) }) : ""}</Alert> : null}
            <div className="flex flex-wrap gap-2">
              <ReturnButton loanId={open.id} label={`${w.name} · ${open.borrower}`} />
              <LinkButton href={`/weapons/loans/${open.id}/receipt`} variant="secondary" target="_blank"><Printer className="h-4 w-4" /> {t("adm2.weapons.detail.receipt")}</LinkButton>
              {open.isMinor ? <ReportButton loanId={open.id} reported={!!open.reportedAt} canUndo={canManage} size="md" /> : null}
            </div>
          </div>
        ) : w.status === "AVAILABLE" ? (
          <p className="text-sm text-ink-2">{t("adm2.weapons.detail.available")}</p>
        ) : (
          <p className="text-sm text-ink-3">{t("adm2.weapons.detail.notLendable", { label: st.label })}</p>
        )}
        <LendButton weapons={[{ id: w.id, name: w.name }]} members={members} defaultReportDays={reportDays} size="lg" hideTrigger={!!open || w.status !== "AVAILABLE"} />
      </Card>

      {/* Daten */}
      <SectionTitle>{t("adm2.weapons.detail.data")}</SectionTitle>
      <Card className="animate-rise mb-4 p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Item label={t("adm2.weapons.form.discipline")} value={w.discipline} />
          <Item label={t("adm2.weapons.form.caliber")} value={w.caliber} />
          <Item label={t("adm2.weapons.form.manufacturer")} value={w.manufacturer} />
          <Item label={t("adm2.weapons.form.model")} value={w.model} />
          {canManage ? <Item label={t("adm2.weapons.form.serial")} value={w.serialNumber} /> : null}
          <Item label={t("adm2.weapons.form.shotCount")} value={t("adm2.weapons.shots", { n: fmt(w.shotCount) })} />
        </dl>
        {w.serviceEveryShots ? (
          <div className="mt-4">
            <ProgressBar value={Math.min(w.shotsSinceService, w.serviceEveryShots)} max={w.serviceEveryShots} tone={sv.byShots ? "warn" : "accent"} label={t("adm2.weapons.detail.sinceService")} />
            <div className="mt-1 text-xs text-ink-3">{t("adm2.weapons.detail.sinceOf", { since: fmt(w.shotsSinceService), every: fmt(w.serviceEveryShots) })}</div>
          </div>
        ) : null}
        <div className="mt-3 text-xs text-ink-3">
          {w.nextServiceAt ? `${t("adm2.weapons.detail.next", { date: day(w.nextServiceAt) })}${sv.daysLeft !== null && sv.daysLeft > 0 ? t("adm2.weapons.detail.inDays", { n: sv.daysLeft }) : ""}. ` : ""}
          {!w.serviceEveryShots && !w.nextServiceAt ? t("adm2.weapons.detail.noInterval") : ""}
        </div>
        {notes ? <p className="mt-3 whitespace-pre-line text-sm text-ink-2">{notes}</p> : null}
      </Card>

      {canManage ? (
        <>
          <SectionTitle>{t("adm2.common.status")}</SectionTitle>
          <Card className="animate-rise mb-4 p-4"><StatusActions weapon={{ id: w.id, name: w.name, status: w.status, hasLoans: w.loans.length > 0, blockReason: w.blockReason }} /></Card>
        </>
      ) : null}

      {/* Wartung */}
      <SectionTitle>{t("adm2.weapons.settings.service")}</SectionTitle>
      {canManage ? <div className="mb-3"><ServiceForm weaponId={w.id} today={today} status={w.status} /></div> : null}
      {w.services.length === 0 ? (
        <p className="mb-4 text-sm text-ink-3">{t("adm2.weapons.detail.noService")}</p>
      ) : (
        <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
          {w.services.map((s) => (
            <div key={s.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-medium">{day(s.date)} <Badge>{serviceKindLabel(s.kind, t)}</Badge></div>
                <div className="text-sm text-ink-2">{s.note ?? "–"}</div>
                <div className="text-xs text-ink-3">{[s.byName, s.costCents !== null ? formatMoneyLocale(s.costCents, locale) : null].filter(Boolean).join(" · ")}</div>
              </div>
              {canManage ? <ServiceDeleteButton id={s.id} /> : null}
            </div>
          ))}
        </Card>
      )}

      {/* Ausleihgeschichte */}
      <SectionTitle>{t("adm2.weapons.detail.loans")}</SectionTitle>
      {w.loans.length === 0 ? (
        <p className="mb-4 text-sm text-ink-3">{t("adm2.weapons.detail.neverLent")}</p>
      ) : (
        <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
          {w.loans.map((l) => (
            <div key={l.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{l.borrower}</span>
                {!l.returnedAt ? <Badge tone={l.overdue ? "danger" : "accent"}>{l.overdue ? t("adm2.weapons.overdue") : t("adm2.weapons.open")}</Badge> : null}
                {l.isMinor ? <Badge tone={l.report.state === "reported" ? "ok" : l.report.state === "overdue" || l.report.state === "soon" ? "warn" : "neutral"}>{l.report.state === "reported" ? t("adm2.weapons.detail.minorReported") : t("adm2.weapons.detail.minorOpen")}</Badge> : null}
              </div>
              <div className="text-xs text-ink-3">
                {dt(l.loanedAt)}{l.returnedAt ? ` – ${dt(l.returnedAt)}` : ""}
                {l.shots !== null ? ` · ${t("adm2.weapons.shots", { n: fmt(l.shots) })}` : ""}
                {l.issuedByName ? t("adm2.weapons.detail.issuedBy", { name: l.issuedByName }) : ""}
                {l.note ? ` · ${l.note}` : ""}
              </div>
            </div>
          ))}
        </Card>
      )}
      <p className="text-xs text-ink-3">{t("adm2.weapons.responsibility")}</p>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="truncate">{value || "–"}</dd>
    </div>
  );
}
