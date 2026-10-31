import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, Pencil, Printer } from "lucide-react";
import { Alert, Badge, Card, LinkButton, PageHeader, ProgressBar, SectionTitle } from "@/components/ui";
import { formatDateTimeZurich, formatDateZurich, todayZurich } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { requireWeapons } from "@/modules/weapons/guard";
import { stripBlockReason } from "@/modules/weapons/logic";
import { defaultMinorReportDays, getWeapon, memberOptions } from "@/modules/weapons/queries";
import { MINOR_HINT, RESPONSIBILITY_HINT, serviceKindLabel, weaponStatusInfo } from "@/modules/weapons/types";
import { LendButton } from "@/modules/weapons/ui/lend-dialog";
import { ReportButton, ReturnButton } from "@/modules/weapons/ui/loan-actions";
import { ServiceForm } from "@/modules/weapons/ui/service-form";
import { StatusActions } from "@/modules/weapons/ui/status-actions";
import { ServiceDeleteButton } from "@/modules/weapons/ui/service-delete";

export const metadata: Metadata = { title: "Vereinswaffe" };

const fmt = (n: number) => new Intl.NumberFormat("de-CH").format(n);
const day = (d: Date) => formatDateZurich(d, { weekday: undefined });

export default async function WeaponDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWeapons();
  const { id } = await params;
  const canManage = ctx.can("weapons.manage");
  const w = await getWeapon(ctx.tenant.id, id.slice(0, 40), canManage);
  if (!w) notFound();
  const st = weaponStatusInfo(w.status);
  const open = w.loans.find((l) => !l.returnedAt) ?? null;
  const [members, reportDays] = w.status === "AVAILABLE" ? await Promise.all([memberOptions(ctx.tenant.id), defaultMinorReportDays(ctx.tenant.id)]) : [[], 30];
  const today = todayZurich();
  const sv = w.service;
  const notes = stripBlockReason(w.notes);

  return (
    <div>
      <PageHeader title={w.name} subtitle={[w.discipline, w.caliber].filter(Boolean).join(" · ") || undefined} back={{ href: "/weapons", label: "Vereinswaffen" }}
        action={canManage ? <LinkButton href={`/weapons/${w.id}/edit`} variant="secondary" aria-label="Bearbeiten"><Pencil className="h-4 w-4" /><span className="hidden sm:inline">Bearbeiten</span></LinkButton> : undefined} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={st.tone} className="text-sm">{st.label}</Badge>
        {sv.due && w.status !== "SERVICE" ? <Badge tone="warn" className="text-sm"><AlertTriangle className="mr-1 h-3.5 w-3.5" /> Wartung fällig</Badge> : null}
      </div>
      {w.blockReason ? <Alert tone="error" title="Gesperrt" className="mb-4">{w.blockReason}</Alert> : null}
      {sv.due ? (
        <Alert tone="warn" title="Wartung fällig" className="mb-4">
          {sv.byShots ? `Intervall von ${fmt(w.serviceEveryShots ?? 0)} Schuss erreicht (${fmt(w.shotsSinceService)} seit der letzten Wartung). ` : ""}
          {sv.byDate && w.nextServiceAt ? `Wartungsdatum ${day(w.nextServiceAt)} erreicht. ` : ""}
          {canManage ? "Nach der Wartung unten «Wartung erfasst» buchen." : "Bitte die Waffenverantwortlichen informieren."}
        </Alert>
      ) : null}

      {/* Ausleihe */}
      {/* LendButton steht immer an derselben Stelle (nur der Knopf wird ausgeblendet), damit der Erfolgsdialog
          nach dem Ausleihen das Neuladen der Seite übersteht (die Seite zeigt dann die offene Ausleihe). */}
      <Card className="animate-rise mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        {open ? (
          <div className="w-full space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-3">Ausgeliehen an</div>
              <div className="text-lg font-semibold">{open.borrower}</div>
              <div className="text-sm text-ink-3">
                seit {formatDateTimeZurich(open.loanedAt)}{open.dueAt ? ` · zurück bis ${day(open.dueAt)}` : ""}{open.onSiteOnly ? " · nur am Stand" : ""}
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {open.overdue ? <Badge tone="danger">überfällig</Badge> : null}
                {open.isMinor ? <Badge tone="warn">minderjährig</Badge> : null}
              </div>
            </div>
            {open.isMinor && open.report.state !== "reported" ? <Alert tone="warn">{MINOR_HINT}{open.reportDueAt ? ` Meldung bis ${day(open.reportDueAt)}.` : ""}</Alert> : null}
            <div className="flex flex-wrap gap-2">
              <ReturnButton loanId={open.id} label={`${w.name} · ${open.borrower}`} />
              <LinkButton href={`/weapons/loans/${open.id}/receipt`} variant="secondary" target="_blank"><Printer className="h-4 w-4" /> Quittung</LinkButton>
              {open.isMinor ? <ReportButton loanId={open.id} reported={!!open.reportedAt} canUndo={canManage} size="md" /> : null}
            </div>
          </div>
        ) : w.status === "AVAILABLE" ? (
          <p className="text-sm text-ink-2">Die Waffe ist verfügbar.</p>
        ) : (
          <p className="text-sm text-ink-3">Zurzeit nicht ausleihbar ({st.label}).</p>
        )}
        <LendButton weapons={[{ id: w.id, name: w.name }]} members={members} defaultReportDays={reportDays} size="lg" hideTrigger={!!open || w.status !== "AVAILABLE"} />
      </Card>

      {/* Daten */}
      <SectionTitle>Angaben</SectionTitle>
      <Card className="animate-rise mb-4 p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Item label="Disziplin" value={w.discipline} />
          <Item label="Kaliber" value={w.caliber} />
          <Item label="Hersteller" value={w.manufacturer} />
          <Item label="Modell" value={w.model} />
          {canManage ? <Item label="Seriennummer" value={w.serialNumber} /> : null}
          <Item label="Schusszähler" value={`${fmt(w.shotCount)} Schuss`} />
        </dl>
        {w.serviceEveryShots ? (
          <div className="mt-4">
            <ProgressBar value={Math.min(w.shotsSinceService, w.serviceEveryShots)} max={w.serviceEveryShots} tone={sv.byShots ? "warn" : "accent"} label="Schuss seit der letzten Wartung" />
            <div className="mt-1 text-xs text-ink-3">{fmt(w.shotsSinceService)} von {fmt(w.serviceEveryShots)} Schuss seit der letzten Wartung</div>
          </div>
        ) : null}
        <div className="mt-3 text-xs text-ink-3">
          {w.nextServiceAt ? `Nächste Wartung am ${day(w.nextServiceAt)}${sv.daysLeft !== null && sv.daysLeft > 0 ? ` (in ${sv.daysLeft} Tagen)` : ""}. ` : ""}
          {!w.serviceEveryShots && !w.nextServiceAt ? "Kein Wartungsintervall festgelegt." : ""}
        </div>
        {notes ? <p className="mt-3 whitespace-pre-line text-sm text-ink-2">{notes}</p> : null}
      </Card>

      {canManage ? (
        <>
          <SectionTitle>Status</SectionTitle>
          <Card className="animate-rise mb-4 p-4"><StatusActions weapon={{ id: w.id, name: w.name, status: w.status, hasLoans: w.loans.length > 0 }} /></Card>
        </>
      ) : null}

      {/* Wartung */}
      <SectionTitle>Wartung</SectionTitle>
      {canManage ? <div className="mb-3"><ServiceForm weaponId={w.id} today={today} status={w.status} /></div> : null}
      {w.services.length === 0 ? (
        <p className="mb-4 text-sm text-ink-3">Noch keine Wartung erfasst.</p>
      ) : (
        <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
          {w.services.map((s) => (
            <div key={s.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-medium">{day(s.date)} <Badge>{serviceKindLabel(s.kind)}</Badge></div>
                <div className="text-sm text-ink-2">{s.note ?? "–"}</div>
                <div className="text-xs text-ink-3">{[s.byName, s.costCents !== null ? formatMoney(s.costCents, "CHF") : null].filter(Boolean).join(" · ")}</div>
              </div>
              {canManage ? <ServiceDeleteButton id={s.id} /> : null}
            </div>
          ))}
        </Card>
      )}

      {/* Ausleihgeschichte */}
      <SectionTitle>Ausleihen</SectionTitle>
      {w.loans.length === 0 ? (
        <p className="mb-4 text-sm text-ink-3">Noch nie ausgeliehen.</p>
      ) : (
        <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
          {w.loans.map((l) => (
            <div key={l.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{l.borrower}</span>
                {!l.returnedAt ? <Badge tone={l.overdue ? "danger" : "accent"}>{l.overdue ? "überfällig" : "offen"}</Badge> : null}
                {l.isMinor ? <Badge tone={l.report.state === "reported" ? "ok" : l.report.state === "overdue" || l.report.state === "soon" ? "warn" : "neutral"}>{l.report.state === "reported" ? "minderjährig · gemeldet" : "minderjährig · Meldung offen"}</Badge> : null}
              </div>
              <div className="text-xs text-ink-3">
                {formatDateTimeZurich(l.loanedAt)}{l.returnedAt ? ` – ${formatDateTimeZurich(l.returnedAt)}` : ""}
                {l.shots !== null ? ` · ${fmt(l.shots)} Schuss` : ""}
                {l.issuedByName ? ` · ausgegeben von ${l.issuedByName}` : ""}
                {l.note ? ` · ${l.note}` : ""}
              </div>
            </div>
          ))}
        </Card>
      )}
      <p className="text-xs text-ink-3">{RESPONSIBILITY_HINT}</p>
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
