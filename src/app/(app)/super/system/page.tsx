import type { Metadata } from "next";
import { Activity, Mail, Server } from "lucide-react";
import { requireSuperAdmin } from "@/lib/tenant";
import { db } from "@/lib/db";
import { formatDateTimeZurich } from "@/lib/time";
import { smtpConfigured } from "@/lib/mail/transport";
import { registeredJobs } from "@/lib/jobs";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { FailedMailRow, JobRunButton, RetryAllButton, TestMailButton } from "./forms";

export const metadata: Metadata = { title: "System" };
export const dynamic = "force-dynamic";

const STATUSES = ["QUEUED", "SENDING", "SENT", "FAILED", "SKIPPED"] as const;
const STATUS_LABEL: Record<string, string> = { QUEUED: "Wartend", SENDING: "Im Versand", SENT: "Versendet", FAILED: "Fehlgeschlagen", SKIPPED: "Übersprungen" };
const KNOWN_JOBS: Record<string, { label: string; every: string }> = {
  "mail.send": { label: "Mailversand", every: "alle 30 s" },
  cleanup: { label: "Aufräumen (Sessions, Tokens, alte Mails)", every: "stündlich" },
  "tenant.purge": { label: "Gelöschte Vereine endgültig entfernen", every: "täglich" },
  reminders: { label: "Erinnerungen", every: "stündlich" },
};

function humanInterval(ms: number) {
  if (ms < 60_000) return `alle ${Math.round(ms / 1000)} s`;
  if (ms < 3_600_000) return `alle ${Math.round(ms / 60_000)} Min.`;
  if (ms < 86_400_000) return `alle ${Math.round(ms / 3_600_000)} Std.`;
  return `alle ${Math.round(ms / 86_400_000)} Tage`;
}

async function loadSystemData() {
  const now = Date.now();
  const since = new Date(now - 7 * 86_400_000);
  const [locks, grouped, failed, queuedTotal] = await Promise.all([
    db.jobLock.findMany({ orderBy: { name: "asc" } }),
    db.mailMessage.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    db.mailMessage.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, toEmail: true, subject: true, kind: true, attempts: true, lastError: true, createdAt: true },
    }),
    db.mailMessage.count({ where: { status: "QUEUED" } }),
  ]);
  return { now, locks, grouped, failed, queuedTotal };
}

export default async function SystemPage() {
  const user = await requireSuperAdmin();
  const { now, locks, grouped, failed, queuedTotal } = await loadSystemData();
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<string, number>;
  for (const g of grouped) counts[g.status] = g._count._all;

  // Registrierte Jobs dieses Prozesses + bekannte DB-Zeilen zusammenführen.
  const registered = new Map(registeredJobs().map((j) => [j.name, j.everyMs]));
  const names = [...new Set([...Object.keys(KNOWN_JOBS), ...registered.keys(), ...locks.map((l) => l.name)])].sort();
  const lockByName = new Map(locks.map((l) => [l.name, l]));
  const jobsOff = process.env.JOBS_DISABLED === "1" || process.env.JOBS_DISABLED === "true";
  const smtp = smtpConfigured();

  return (
    <div>
      <PageHeader title="System" subtitle="Hintergrundjobs und Mailversand" back={{ href: "/super", label: "Globale Verwaltung" }} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="SMTP" value={smtp ? "Bereit" : "Aus"} tone={smtp ? "ok" : "warn"} icon={<Server className="h-4 w-4" />} hint={smtp ? "SMTP_HOST gesetzt" : "SMTP_HOST fehlt"} />
        <StatCard label="Warteschlange" value={queuedTotal} icon={<Mail className="h-4 w-4" />} hint="wartende Mails" />
        <StatCard label="Versendet (7 Tage)" value={counts.SENT} tone="ok" />
        <StatCard label="Fehler (7 Tage)" value={counts.FAILED} tone={counts.FAILED ? "warn" : "neutral"} />
      </div>

      {!smtp ? (
        <p className="mt-3 rounded-control bg-warn/10 px-3.5 py-2.5 text-sm text-warn">
          Ohne SMTP werden Mails nicht versendet, sondern als «Übersprungen» markiert. Umgebungsvariablen: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM.
        </p>
      ) : null}
      <div className="mt-3">
        <TestMailButton email={user.email} />
      </div>

      <SectionTitle>Mails der letzten 7 Tage</SectionTitle>
      <Card className="animate-rise flex flex-wrap gap-2 p-4">
        {STATUSES.map((s) => (
          <Badge key={s} tone={s === "FAILED" ? (counts[s] ? "danger" : "outline") : s === "SENT" ? "ok" : s === "SKIPPED" ? "warn" : "neutral"}>
            {STATUS_LABEL[s]}: <span className="ml-1 tabular-nums">{counts[s]}</span>
          </Badge>
        ))}
      </Card>

      <SectionTitle>Hintergrundjobs</SectionTitle>
      {jobsOff ? <p className="mb-2 rounded-control bg-warn/10 px-3.5 py-2.5 text-sm text-warn">Jobs sind mit JOBS_DISABLED abgeschaltet.</p> : null}
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {names.map((name) => {
          const l = lockByName.get(name);
          const known = KNOWN_JOBS[name];
          const every = registered.has(name) ? humanInterval(registered.get(name)!) : known?.every;
          const running = !!l?.lockedUntil && l.lockedUntil.getTime() > now;
          return (
            <div key={name} className="flex items-center gap-3 px-4 py-3">
              <Activity className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {known?.label ?? name}
                  {running ? <Badge tone="accent">Läuft</Badge> : l?.lastStatus === "OK" ? <Badge tone="ok">OK</Badge> : l?.lastStatus === "ERROR" ? <Badge tone="danger">Fehler</Badge> : <Badge tone="outline">Noch nie</Badge>}
                </p>
                <p className="text-xs text-ink-3">
                  <span className="font-mono">{name}</span>
                  {every ? ` · ${every}` : ""}
                  {l?.lastRunAt ? ` · zuletzt ${formatDateTimeZurich(l.lastRunAt)}` : ""}
                </p>
                {l?.lastStatus === "ERROR" && l.lastError ? <p className="mt-1 break-words text-xs text-danger">{l.lastError}</p> : null}
              </div>
              {registered.has(name) ? <JobRunButton name={name} /> : null}
            </div>
          );
        })}
      </Card>

      <SectionTitle action={failed.length ? <RetryAllButton /> : undefined}>Fehlgeschlagene Mails</SectionTitle>
      {failed.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {failed.map((m) => (
            <FailedMailRow
              key={m.id}
              id={m.id}
              to={m.toEmail}
              subject={m.subject}
              kind={m.kind ?? "mail"}
              attempts={m.attempts}
              error={m.lastError ?? ""}
              createdAt={formatDateTimeZurich(m.createdAt)}
            />
          ))}
        </Card>
      ) : (
        <EmptyState icon={<Mail className="h-5 w-5" />} title="Keine Fehler" text="Alle Mails wurden versendet oder warten noch." />
      )}
      <p className="mt-3 text-xs text-ink-3">Aus Datenschutzgründen werden hier keine Mailinhalte angezeigt.</p>
    </div>
  );
}
