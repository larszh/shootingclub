import type { Metadata } from "next";
import { getAppContext } from "@/lib/tenant";
import { db } from "@/lib/db";
import { getRequestLocale, getT, normalizeLocale } from "@/lib/i18n";
import { isPushConfigured } from "@/lib/push";
import { preferenceMatrix } from "@/lib/push/topics";
import { PageHeader, SectionTitle } from "@/components/ui";
import { DeviceCard, LanguageCard, TopicsCard } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.ui.notifications") };
}

export default async function NotificationsPage() {
  const ctx = await getAppContext();
  const t = getT(await getRequestLocale());
  const [rows, devices] = await Promise.all([
    db.notificationPreference.findMany({ where: { userId: ctx.user.id }, select: { channel: true, topic: true, enabled: true } }),
    db.pushSubscription.count({ where: { userId: ctx.user.id } }),
  ]);

  return (
    <div>
      <PageHeader title={t("shell.ui.notifications")} subtitle={t("shell.notifications.subtitle")} back={{ href: "/me", label: t("shell.nav.more") }} />

      <SectionTitle>{t("shell.notifications.language")}</SectionTitle>
      <LanguageCard locale={normalizeLocale(ctx.user.locale)} />

      <SectionTitle>{t("shell.notifications.thisDevice")}</SectionTitle>
      <DeviceCard configured={isPushConfigured()} devices={devices} />

      <SectionTitle>{t("shell.notifications.what")}</SectionTitle>
      <TopicsCard prefs={preferenceMatrix(rows)} email={ctx.user.email} />
    </div>
  );
}
