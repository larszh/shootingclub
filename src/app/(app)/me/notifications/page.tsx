import type { Metadata } from "next";
import { getAppContext } from "@/lib/tenant";
import { db } from "@/lib/db";
import { normalizeLocale } from "@/lib/i18n";
import { isPushConfigured } from "@/lib/push";
import { preferenceMatrix } from "@/lib/push/topics";
import { PageHeader, SectionTitle } from "@/components/ui";
import { DeviceCard, LanguageCard, TopicsCard } from "./forms";

export const metadata: Metadata = { title: "Benachrichtigungen" };

export default async function NotificationsPage() {
  const ctx = await getAppContext();
  const [rows, devices] = await Promise.all([
    db.notificationPreference.findMany({ where: { userId: ctx.user.id }, select: { channel: true, topic: true, enabled: true } }),
    db.pushSubscription.count({ where: { userId: ctx.user.id } }),
  ]);

  return (
    <div>
      <PageHeader title="Benachrichtigungen" subtitle="Sprache, Push-Mitteilungen und E-Mails" back={{ href: "/me", label: "Mehr" }} />

      <SectionTitle>Sprache</SectionTitle>
      <LanguageCard locale={normalizeLocale(ctx.user.locale)} />

      <SectionTitle>Auf diesem Gerät</SectionTitle>
      <DeviceCard configured={isPushConfigured()} devices={devices} />

      <SectionTitle>Was möchtest du erhalten?</SectionTitle>
      <TopicsCard prefs={preferenceMatrix(rows)} email={ctx.user.email} />
    </div>
  );
}
