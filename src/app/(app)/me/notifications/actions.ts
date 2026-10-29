"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, throttle } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { LOCALES, getT, type Locale } from "@/lib/i18n";
import { isPushConfigured, sendPush } from "@/lib/push";
import { LOCKED_EMAIL_TOPICS, NOTIFY_TOPICS, type NotifyTopic } from "@/lib/push/topics";

const localeSchema = z.enum(LOCALES as unknown as [Locale, ...Locale[]]);

/** Sprache des Kontos (Mails, Rechnungen an mich, später die ganze App). */
export async function setLocaleAction(locale: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Bitte neu anmelden.");
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return fail("Diese Sprache gibt es nicht.");
  await db.user.update({ where: { id: user.id }, data: { locale: parsed.data } });
  revalidatePath("/me/notifications");
  return ok(undefined, "Sprache gespeichert.");
}

const prefSchema = z.object({
  channel: z.enum(["PUSH", "EMAIL"]),
  topic: z.enum(NOTIFY_TOPICS as unknown as [NotifyTopic, ...NotifyTopic[]]),
  enabled: z.boolean(),
});

/** Ein Thema für Push oder E-Mail ein- bzw. ausschalten. */
export async function setPreferenceAction(input: { channel: string; topic: string; enabled: boolean }): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Bitte neu anmelden.");
  const parsed = prefSchema.safeParse(input);
  if (!parsed.success) return fail("Ungültige Einstellung.");
  const { channel, topic, enabled } = parsed.data;
  if (channel === "EMAIL" && LOCKED_EMAIL_TOPICS.has(topic) && !enabled) return fail("Wichtige Hinweise zu deinem Konto werden immer per E-Mail gesendet.");
  await db.notificationPreference.upsert({
    where: { userId_channel_topic: { userId: user.id, channel, topic } },
    create: { userId: user.id, channel, topic, enabled },
    update: { enabled },
  });
  return ok();
}

/** Schickt eine Testbenachrichtigung an alle angemeldeten Geräte des Benutzers. */
export async function sendTestNotificationAction(): Promise<ActionResult<{ devices: number }>> {
  const user = await getCurrentUser();
  if (!user) return fail("Bitte neu anmelden.");
  if (!isPushConfigured()) return fail("Push-Benachrichtigungen sind auf diesem Server noch nicht eingerichtet.");
  const limited = throttle(`push-test:${user.id}`, 5, 10 * 60_000);
  if (limited) return fail(limited);
  const devices = await db.pushSubscription.count({ where: { userId: user.id } });
  if (!devices) return fail("Auf keinem Gerät eingeschaltet. Bitte zuerst «Auf diesem Gerät» einschalten.");
  const t = getT(user.locale);
  const sent = await sendPush([user.id], { title: t("notify.test.title"), body: t("notify.test.body"), url: "/me/notifications", tag: "test" }, { ttl: 300, urgency: "high" });
  if (!sent) return fail("Die Benachrichtigung konnte nicht zugestellt werden. Bitte auf diesem Gerät aus- und wieder einschalten.");
  return ok({ devices: sent }, sent === 1 ? "Gesendet – sie sollte gleich erscheinen." : `An ${sent} Geräte gesendet.`);
}
