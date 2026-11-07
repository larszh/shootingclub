import type { Metadata } from "next";
import { Activity, Mail, Server } from "lucide-react";
import { requireSuperAdmin } from "@/lib/tenant";
import { db } from "@/lib/db";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDateTime, type TFunction } from "@/lib/i18n/core";
import { smtpConfigured } from "@/lib/mail/transport";
import { registeredJobs } from "@/lib/jobs";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { FailedMailRow, JobRunButton, RetryAllButton, TestMailButton } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.super.sys.title") };
}
export const dynamic = "force-dynamic";

const STATUSES = ["QUEUED", "SENDING", "SENT", "FAILED", "SKIPPED"] as const;
/** Bekannte Jobs: Schlüssel für Bezeichnung und Intervall im Wörterbuch. */
const KNOWN_JOBS: Record<string, { every: string }> = {
  "mail.send": { every: "every30s" },
  cleanup: { every: "hourly" },
  "tenant.purge": { every: "daily" },
  reminders: { every: "hourly" },
  "scores.backfill": { every: "daily" },
  "ai.cache.purge": { every: "daily" },
};

function humanInterval(ms: number, t: TFunction) {
  if (ms < 60_000) return t("adm2.super.sys.everyS", { n: Math.round(ms / 1000) });
  if (ms < 3_600_000) return t("adm2.super.sys.everyMin", { n: Math.round(ms / 60_000) });
  if (ms < 86_400_000) return t("adm2.super.sys.everyH", { n: Math.round(ms / 3_600_000) });
  return t("adm2.super.sys.everyD", { n: Math.round(ms / 86_400_000) });
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
  const locale = await getRequestLocale();
  const t = getT(locale);
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
      <PageHeader title={t("adm2.super.sys.title")} subtitle={t("adm2.super.sys.subtitle")} back={{ href: "/super", label: t("adm2.super.sys.back") }} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="SMTP" value={smtp ? t("adm2.super.sys.ready") : t("adm2.super.sys.off")} tone={smtp ? "ok" : "warn"} icon={<Server className="h-4 w-4" />} hint={smtp ? t("adm2.super.sys.hostSet") : t("adm2.super.sys.hostMissing")} />
        <StatCard label={t("adm2.super.sys.queue")} value={queuedTotal} icon={<Mail className="h-4 w-4" />} hint={t("adm2.super.sys.queueHint")} />
        <StatCard label={t("adm2.super.sys.sent7")} value={counts.SENT} tone="ok" />
        <StatCard label={t("adm2.super.sys.failed7")} value={counts.FAILED} tone={counts.FAILED ? "warn" : "neutral"} />
      </div>

      {!smtp ? (
        <p className="mt-3 rounded-control bg-warn/10 px-3.5 py-2.5 text-sm text-warn">
          {t("adm2.super.sys.noSmtp")}
        </p>
      ) : null}
      <div className="mt-3">
        <TestMailButton email={user.email} />
      </div>

      <SectionTitle>{t("adm2.super.sys.mails7")}</SectionTitle>
      <Card className="animate-rise flex flex-wrap gap-2 p-4">
        {STATUSES.map((s) => (
          <Badge key={s} tone={s === "FAILED" ? (counts[s] ? "danger" : "outline") : s === "SENT" ? "ok" : s === "SKIPPED" ? "warn" : "neutral"}>
            {t(`adm2.super.sys.status.${s}`)}: <span className="ml-1 tabular-nums">{counts[s]}</span>
          </Badge>
        ))}
      </Card>

      <SectionTitle>{t("adm2.super.sys.jobs")}</SectionTitle>
      {jobsOff ? <p className="mb-2 rounded-control bg-warn/10 px-3.5 py-2.5 text-sm text-warn">{t("adm2.super.sys.jobsOff")}</p> : null}
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {names.map((name) => {
          const l = lockByName.get(name);
          const known = KNOWN_JOBS[name];
          const every = registered.has(name) ? humanInterval(registered.get(name)!, t) : known ? t(`adm2.super.sys.${known.every}`) : undefined;
          const running = !!l?.lockedUntil && l.lockedUntil.getTime() > now;
          return (
            <div key={name} className="flex items-center gap-3 px-4 py-3">
              <Activity className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {known ? t(`adm2.super.sys.job.${name}`) : name}
                  {running ? <Badge tone="accent">{t("adm2.super.sys.running")}</Badge> : l?.lastStatus === "OK" ? <Badge tone="ok">OK</Badge> : l?.lastStatus === "ERROR" ? <Badge tone="danger">{t("adm2.super.sys.error")}</Badge> : <Badge tone="outline">{t("adm2.super.sys.never")}</Badge>}
                </p>
                <p className="text-xs text-ink-3">
                  <span className="font-mono">{name}</span>
                  {every ? ` · ${every}` : ""}
                  {l?.lastRunAt ? t("adm2.super.sys.last", { date: formatDateTime(l.lastRunAt, locale) }) : ""}
                </p>
                {l?.lastStatus === "ERROR" && l.lastError ? <p className="mt-1 break-words text-xs text-danger">{l.lastError}</p> : null}
              </div>
              {registered.has(name) ? <JobRunButton name={name} /> : null}
            </div>
          );
        })}
      </Card>

      <SectionTitle action={failed.length ? <RetryAllButton /> : undefined}>{t("adm2.super.sys.failedMails")}</SectionTitle>
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
              createdAt={formatDateTime(m.createdAt, locale)}
            />
          ))}
        </Card>
      ) : (
        <EmptyState icon={<Mail className="h-5 w-5" />} title={t("adm2.super.sys.noErrors")} text={t("adm2.super.sys.noErrorsText")} />
      )}
      <p className="mt-3 text-xs text-ink-3">{t("adm2.super.sys.privacy")}</p>
    </div>
  );
}
