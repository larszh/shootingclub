"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, throttle } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { LOCALES, getRequestLocale, getT, type Locale } from "@/lib/i18n";
import { isPushConfigured, sendPush } from "@/lib/push";
import { LOCKED_EMAIL_TOPICS, NOTIFY_TOPICS, type NotifyTopic } from "@/lib/push/topics";

const localeSchema = z.enum(LOCALES as unknown as [Locale, ...Locale[]]);

/** Sprache des Kontos (Mails, Rechnungen an mich, später die ganze App). */
export async function setLocaleAction(locale: string): Promise<ActionResult> {
  const t = getT(await getRequestLocale());
  const user = await getCurrentUser();
  if (!user) return fail(t("shell.common.reloginRequired"));
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return fail(t("shell.notifications.msg.unknownLocale"));
  await db.user.update({ where: { id: user.id }, data: { locale: parsed.data } });
  // Die ganze Oberfläche (Layout, Navigation) wechselt die Sprache.
  revalidatePath("/", "layout");
  // Bestätigung bereits in der neuen Sprache.
  return ok(undefined, getT(parsed.data)("shell.notifications.msg.localeSaved"));
}

const prefSchema = z.object({
  channel: z.enum(["PUSH", "EMAIL"]),
  topic: z.enum(NOTIFY_TOPICS as unknown as [NotifyTopic, ...NotifyTopic[]]),
  enabled: z.boolean(),
});

/** Ein Thema für Push oder E-Mail ein- bzw. ausschalten. */
export async function setPreferenceAction(input: { channel: string; topic: string; enabled: boolean }): Promise<ActionResult> {
  const t = getT(await getRequestLocale());
  const user = await getCurrentUser();
  if (!user) return fail(t("shell.common.reloginRequired"));
  const parsed = prefSchema.safeParse(input);
  if (!parsed.success) return fail(t("shell.notifications.msg.invalidSetting"));
  const { channel, topic, enabled } = parsed.data;
  if (channel === "EMAIL" && LOCKED_EMAIL_TOPICS.has(topic) && !enabled) return fail(t("shell.notifications.msg.lockedEmail"));
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
  if (!user) return fail(getT(await getRequestLocale())("shell.common.reloginRequired"));
  const t = getT(user.locale);
  if (!isPushConfigured()) return fail(t("shell.notifications.msg.notConfigured"));
  const limited = throttle(`push-test:${user.id}`, 5, 10 * 60_000);
  if (limited) {
    const m = limited.match(/(\d+) Minute/);
    const minutes = m ? Number(m[1]) : null;
    return fail(minutes === null ? limited : minutes === 1 ? t("shell.msg.throttleOne") : t("shell.msg.throttle", { minutes }));
  }
  const devices = await db.pushSubscription.count({ where: { userId: user.id } });
  if (!devices) return fail(t("shell.notifications.msg.noDevice"));
  const sent = await sendPush([user.id], { title: t("notify.test.title"), body: t("notify.test.body"), url: "/me/notifications", tag: "test" }, { ttl: 300, urgency: "high" });
  if (!sent) return fail(t("shell.notifications.msg.notDelivered"));
  return ok({ devices: sent }, sent === 1 ? t("shell.notifications.msg.sentOne") : t("shell.notifications.msg.sentMany", { count: sent }));
}
