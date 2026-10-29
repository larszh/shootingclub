import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { getAppContext } from "@/lib/tenant";
import { currentSessionHash, SESSION_START_ACTION } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTimeZurich, formatDateZurich } from "@/lib/time";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { countRecoveryCodes } from "@/modules/core/two-factor";
import { PasswordCard, SessionsCard, TwoFactorCard } from "./forms";

export const metadata: Metadata = { title: "Sicherheit" };

async function loadSecurity(userId: string) {
  const [user, sessions, current] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { totpEnabledAt: true, passwordSetAt: true } }),
    db.session.findMany({ where: { userId, expiresAt: { gt: new Date() } }, select: { id: true, createdAt: true, expiresAt: true, tokenHash: true }, orderBy: { createdAt: "desc" } }),
    currentSessionHash(),
  ]);
  // Gerät und IP, beim Anmelden festgehalten (ältere Sitzungen haben keinen Eintrag).
  const oldest = sessions.at(-1)?.createdAt;
  const starts = sessions.length
    ? await db.auditLog.findMany({
        where: { actorId: userId, action: SESSION_START_ACTION, entity: "Session", entityId: { in: sessions.map((s) => s.id) }, ...(oldest ? { createdAt: { gte: new Date(oldest.getTime() - 60_000) } } : {}) },
        select: { entityId: true, detail: true, ip: true },
      })
    : [];
  const device = new Map(starts.map((r) => [r.entityId, { label: r.detail, ip: r.ip }]));
  return [user, sessions.map((s) => ({ ...s, device: device.get(s.id) ?? null })), current] as const;
}

export default async function SecurityPage() {
  const ctx = await getAppContext();
  const [user, sessions, current] = await loadSecurity(ctx.user.id);
  const enabled = !!user?.totpEnabledAt;
  const recoveryLeft = enabled ? await countRecoveryCodes(ctx.user.id) : 0;

  return (
    <div>
      <PageHeader title="Sicherheit" subtitle="Passwort, Zwei-Faktor-Anmeldung und angemeldete Geräte" back={{ href: "/me", label: "Mehr" }} />

      <Card className="animate-rise flex items-start gap-3 p-4">
        <span className={enabled ? "mt-0.5 text-ok" : "mt-0.5 text-ink-3"} aria-hidden><ShieldCheck className="h-6 w-6" /></span>
        <div className="min-w-0">
          <p className="font-semibold">{enabled ? "Gut geschützt" : "Grundschutz aktiv"}</p>
          <p className="text-sm text-ink-3">
            {enabled
              ? `Zwei-Faktor-Anmeldung ist seit ${formatDateZurich(user!.totpEnabledAt!, { weekday: undefined })} aktiv.`
              : "Dein Konto ist mit Passwort geschützt. Mit der Zwei-Faktor-Anmeldung wird es noch sicherer."}
          </p>
          {user?.passwordSetAt ? <p className="mt-1 text-xs text-ink-3">Passwort zuletzt gesetzt: {formatDateZurich(user.passwordSetAt, { weekday: undefined })}</p> : null}
        </div>
      </Card>

      <SectionTitle>Passwort ändern</SectionTitle>
      <PasswordCard email={ctx.user.email} />

      <SectionTitle>
        <span className="inline-flex items-center gap-2">Zwei-Faktor-Anmeldung {enabled ? <Badge tone="ok">Aktiv</Badge> : <Badge tone="outline">Aus</Badge>}</span>
      </SectionTitle>
      <TwoFactorCard enabled={enabled} recoveryLeft={recoveryLeft} />

      <SectionTitle>Angemeldete Geräte</SectionTitle>
      <SessionsCard
        sessions={sessions.map((s) => ({
          id: s.id,
          current: s.tokenHash === current,
          device: s.device?.label ?? null,
          ip: s.device?.ip ?? null,
          since: formatDateTimeZurich(s.createdAt),
          until: formatDateZurich(s.expiresAt, { weekday: undefined }),
        }))}
      />
    </div>
  );
}
