import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/tenant";
import { ROLE_LABELS, TENANT_ROLES } from "@/lib/permissions";
import { Card, SectionTitle } from "@/components/ui";
import { OnboardingForms } from "./forms";
import { lookupJoinTenant, normalizeJoinCode } from "@/app/(auth)/join-code";
import { db } from "@/lib/db";
import { formatDate, getRequestLocale, getT } from "@/lib/i18n";
import { PendingJoinRequests } from "./pending";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.onboarding.meta") };
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ force?: string; code?: string | string[]; requested?: string }> }) {
  const ctx = await getAppContext();
  const sp = await searchParams;
  // Offene Beitrittsanfragen (Beitritt mit Freigabe): ohne Zugang landet die Person hier.
  const pendingRows = await db.membership.findMany({
    where: { userId: ctx.user.id, status: "PENDING", tenant: { deletedAt: null } },
    include: { tenant: { select: { id: true, name: true, city: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (ctx.tenant && !sp.force && !(sp.requested && pendingRows.length)) redirect("/");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const pendingRequests = pendingRows.map((m) => ({
    id: m.id, clubName: m.tenant.name, city: m.tenant.city,
    // Kein Logo: /api/avatars/tenant liefert es nur an Mitglieder mit Zugang (PENDING hat keinen).
    logoUrl: null,
    since: formatDate(m.createdAt, locale),
  }));
  const code = normalizeJoinCode(sp.code);
  const codeTenant = await lookupJoinTenant(code);
  const firstName = ctx.user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-xl">
      {pendingRequests.length ? (
        <>
          <div className="animate-rise mb-4">
            <h1 className="text-2xl font-semibold tracking-tight">{t("bookings.join.waiting.title")}</h1>
            <p className="mt-1 text-sm text-ink-3">{t(pendingRequests.length === 1 ? "bookings.join.waiting.textOne" : "bookings.join.waiting.textMany", { club: pendingRequests[0]!.clubName })}</p>
          </div>
          <PendingJoinRequests requests={pendingRequests} locale={locale} />
        </>
      ) : null}
      <div className="animate-rise mb-6">
        <h1 className={pendingRequests.length ? "text-lg font-semibold tracking-tight" : "text-2xl font-semibold tracking-tight"}>{ctx.tenant || pendingRequests.length ? t("shell.onboarding.another") : t("shell.onboarding.welcome", { name: firstName ?? "" })}</h1>
        <p className="mt-1 text-sm text-ink-3">{t("shell.onboarding.intro")}</p>
      </div>

      <OnboardingForms initialCode={code ?? undefined} codeTenant={codeTenant} />

      <SectionTitle>{t("shell.onboarding.rolesTitle")}</SectionTitle>
      <Card className="animate-rise divide-y divide-line">
        {TENANT_ROLES.map((r) => (
          <div key={r} className="flex gap-3 px-4 py-3">
            <span className="w-20 shrink-0 text-sm font-semibold">{t(`role.${r}`) === `role.${r}` ? ROLE_LABELS[r] : t(`role.${r}`)}</span>
            <span className="text-sm text-ink-3">{t(`shell.onboarding.role.${r}`)}</span>
          </div>
        ))}
      </Card>
      <p className="mt-3 text-xs text-ink-3">{t("shell.onboarding.rolesNote")}</p>
    </div>
  );
}
