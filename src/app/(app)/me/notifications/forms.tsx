"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Mail, Send, Share, Smartphone, SquarePlus } from "lucide-react";
import { Alert, Button, Card } from "@/components/ui";
import { Segmented, Switch } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { LOCALE_LABELS, type Locale } from "@/lib/i18n/locales";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push/client";
import { LOCKED_EMAIL_TOPICS, NOTIFY_TOPICS, type NotifyTopic, type PreferenceMatrix } from "@/lib/push/topics";
import { useT } from "@/components/locale";
import { sendTestNotificationAction, setLocaleAction, setPreferenceAction } from "./actions";

/* ------------------------------------------------------------------ Sprache */

export function LanguageCard({ locale }: { locale: Locale }) {
  const t = useT();
  const [value, setValue] = useState<Locale>(locale);
  const [pending, start] = useTransition();
  return (
    <Card className="animate-rise p-4 space-y-3">
      <Segmented<Locale>
        label={t("shell.notifications.language")}
        value={value}
        onChange={(v) => {
          const prev = value;
          setValue(v);
          start(async () => {
            const res = await setLocaleAction(v);
            if (res.ok) toast.success(res.message ?? t("shell.common.saved"));
            else {
              setValue(prev);
              toast.error(res.error);
            }
          });
        }}
        options={(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => ({ value: l, label: LOCALE_LABELS[l], disabled: pending }))}
      />
      <p className="text-sm text-ink-3">
        {t("shell.notifications.languageHint")}
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------- Dieses Gerät */

/** Schlüssel-Teil pro Zustand: shell.notifications.state.<x>.title / .text */
const STATE_KEY: Record<PushState, string> = {
  enabled: "enabled",
  disabled: "disabled",
  denied: "denied",
  unsupported: "unsupported",
  "ios-needs-install": "iosInstall",
  "not-configured": "notConfigured",
};

export function DeviceCard({ configured, devices }: { configured: boolean; devices: number }) {
  const t = useT();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, startTest] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getPushState().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(on: boolean) {
    setBusy(true);
    try {
      const next = on ? await enablePush() : await disablePush();
      setState(next);
      if (on && next === "enabled") toast.success(t("shell.push.enabled"));
      else if (on && next === "denied") toast.error(t("shell.push.denied"));
      else if (!on) toast.success(t("shell.notifications.offOnDevice"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("shell.common.failed"));
    } finally {
      setBusy(false);
    }
  }

  const info = state ? { title: t(`shell.notifications.state.${STATE_KEY[state]}.title`), text: t(`shell.notifications.state.${STATE_KEY[state]}.text`) } : null;
  const canToggle = state === "enabled" || state === "disabled";
  const otherDevices = Math.max(0, devices - (state === "enabled" ? 1 : 0));

  return (
    <Card className="animate-rise p-4 space-y-4">
      {!state ? (
        <div className="flex items-center gap-2 text-sm text-ink-3"><Spinner /> {t("shell.notifications.checking")}</div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span className={state === "enabled" ? "mt-0.5 text-ok" : "mt-0.5 text-ink-3"} aria-hidden>
              {state === "enabled" ? <Bell className="h-5 w-5" /> : state === "ios-needs-install" ? <Smartphone className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              {canToggle ? (
                <Switch
                  label={t("shell.notifications.push")}
                  description={info?.text}
                  checked={state === "enabled"}
                  disabled={busy || !configured}
                  onChange={(v) => void toggle(v)}
                />
              ) : (
                <>
                  <p className="font-medium">{info?.title}</p>
                  <p className="text-sm text-ink-3">{info?.text}</p>
                </>
              )}
            </div>
          </div>

          {state === "ios-needs-install" ? <IosInstallSteps /> : null}

          {devices > 0 ? (
            <p className="text-sm text-ink-3">
              {state === "enabled"
                ? otherDevices > 0
                  ? t(otherDevices === 1 ? "shell.notifications.onThisAndOne" : "shell.notifications.onThisAndMany", { count: otherDevices })
                  : t("shell.notifications.onlyThis")
                : t(devices === 1 ? "shell.notifications.onOtherOne" : "shell.notifications.onOtherMany", { count: devices })}
            </p>
          ) : null}

          {configured && (state === "enabled" || devices > 0) ? (
            <Button
              variant="secondary"
              className="w-full"
              disabled={testing}
              onClick={() =>
                startTest(async () => {
                  const res = await sendTestNotificationAction();
                  if (res.ok) toast.success(res.message ?? t("shell.notifications.sent"));
                  else toast.error(res.error);
                })
              }
            >
              {testing ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />} {t("shell.notifications.sendTest")}
            </Button>
          ) : null}
        </>
      )}
    </Card>
  );
}

function IosInstallSteps() {
  const t = useT();
  return (
    <Alert tone="info" title={t("shell.notifications.ios.title")}>
      <ol className="mt-1 list-decimal space-y-1 pl-5">
        <li>
          {t("shell.notifications.ios.step1a")} <Share className="inline h-4 w-4 align-[-2px]" aria-label={t("shell.notifications.ios.share")} /> {t("shell.notifications.ios.step1b")}
        </li>
        <li>
          <SquarePlus className="inline h-4 w-4 align-[-2px]" aria-hidden /> {t("shell.notifications.ios.step2")}
        </li>
        <li>{t("shell.notifications.ios.step3")}</li>
      </ol>
    </Alert>
  );
}

/* ------------------------------------------------------------------ Themen */

export function TopicsCard({ prefs, email }: { prefs: PreferenceMatrix; email: string }) {
  const t = useT();
  const [values, setValues] = useState<PreferenceMatrix>(prefs);
  const [, start] = useTransition();

  function change(topic: NotifyTopic, channel: "push" | "email", enabled: boolean) {
    const prev = values[topic][channel];
    setValues((v) => ({ ...v, [topic]: { ...v[topic], [channel]: enabled } }));
    start(async () => {
      const res = await setPreferenceAction({ channel: channel === "push" ? "PUSH" : "EMAIL", topic, enabled });
      if (!res.ok) {
        setValues((v) => ({ ...v, [topic]: { ...v[topic], [channel]: prev } }));
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {NOTIFY_TOPICS.map((topic) => {
          const info = { label: t(`notify.topic.${topic}`), hint: t(`shell.notifications.topicHint.${topic}`) };
          const locked = LOCKED_EMAIL_TOPICS.has(topic);
          return (
            <div key={topic} className="p-4" role="group" aria-labelledby={`topic-${topic}`}>
              <p id={`topic-${topic}`} className="font-medium">{info.label}</p>
              <p className="text-sm text-ink-3">{info.hint}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Switch
                  label={<span className="inline-flex items-center gap-1.5 text-sm"><Bell className="h-4 w-4 text-ink-3" aria-hidden /> Push<span className="sr-only">: {info.label}</span></span>}
                  checked={values[topic].push}
                  onChange={(v) => change(topic, "push", v)}
                />
                <Switch
                  label={<span className="inline-flex items-center gap-1.5 text-sm"><Mail className="h-4 w-4 text-ink-3" aria-hidden /> E-Mail<span className="sr-only">: {info.label}</span></span>}
                  checked={locked ? true : values[topic].email}
                  disabled={locked}
                  onChange={(v) => change(topic, "email", v)}
                />
              </div>
            </div>
          );
        })}
      </Card>
      <p className="mt-2.5 text-sm text-ink-3">
        {t("shell.notifications.emailInfo", { email })}
      </p>
    </>
  );
}
