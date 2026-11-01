import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { getAppContext } from "@/lib/tenant";
import { currentSessionHash, SESSION_START_ACTION } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, getRequestLocale, getT } from "@/lib/i18n";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { countRecoveryCodes } from "@/modules/core/two-factor";
import { PasswordCard, SessionsCard, TwoFactorCard } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.me.row.security") };
}

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
  const locale = await getRequestLocale();
  const t = getT(locale);

  return (
    <div>
      <PageHeader title={t("shell.me.row.security")} subtitle={t("shell.security.subtitle")} back={{ href: "/me", label: t("shell.nav.more") }} />

      <Card className="animate-rise flex items-start gap-3 p-4">
        <span className={enabled ? "mt-0.5 text-ok" : "mt-0.5 text-ink-3"} aria-hidden><ShieldCheck className="h-6 w-6" /></span>
        <div className="min-w-0">
          <p className="font-semibold">{enabled ? t("shell.security.wellProtected") : t("shell.security.basic")}</p>
          <p className="text-sm text-ink-3">
            {enabled
              ? t("shell.security.twofaSince", { date: formatDate(user!.totpEnabledAt!, locale) })
              : t("shell.security.basicText")}
          </p>
          {user?.passwordSetAt ? <p className="mt-1 text-xs text-ink-3">{t("shell.security.passwordSet", { date: formatDate(user.passwordSetAt, locale) })}</p> : null}
        </div>
      </Card>

      <SectionTitle>{t("shell.security.changePassword")}</SectionTitle>
      <PasswordCard email={ctx.user.email} />

      <SectionTitle>
        <span className="inline-flex items-center gap-2">{t("shell.security.twofa")} {enabled ? <Badge tone="ok">{t("shell.security.on")}</Badge> : <Badge tone="outline">{t("shell.security.off")}</Badge>}</span>
      </SectionTitle>
      <TwoFactorCard enabled={enabled} recoveryLeft={recoveryLeft} />

      <SectionTitle>{t("shell.security.devices")}</SectionTitle>
      <SessionsCard
        sessions={sessions.map((s) => ({
          id: s.id,
          current: s.tokenHash === current,
          device: s.device?.label ?? null,
          ip: s.device?.ip ?? null,
          since: formatDateTime(s.createdAt, locale),
          until: formatDate(s.expiresAt, locale),
        }))}
      />
    </div>
  );
}
