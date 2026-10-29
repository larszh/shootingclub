"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Mail, Send, Share, Smartphone, SquarePlus } from "lucide-react";
import { Alert, Button, Card } from "@/components/ui";
import { Segmented, Switch } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { LOCALE_LABELS, type Locale } from "@/lib/i18n/locales";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push/client";
import { LOCKED_EMAIL_TOPICS, NOTIFY_TOPICS, TOPIC_INFO, type NotifyTopic, type PreferenceMatrix } from "@/lib/push/topics";
import { sendTestNotificationAction, setLocaleAction, setPreferenceAction } from "./actions";

/* ------------------------------------------------------------------ Sprache */

export function LanguageCard({ locale }: { locale: Locale }) {
  const [value, setValue] = useState<Locale>(locale);
  const [pending, start] = useTransition();
  return (
    <Card className="animate-rise p-4 space-y-3">
      <Segmented<Locale>
        label="Sprache"
        value={value}
        onChange={(v) => {
          const prev = value;
          setValue(v);
          start(async () => {
            const res = await setLocaleAction(v);
            if (res.ok) toast.success(res.message ?? "Gespeichert.");
            else {
              setValue(prev);
              toast.error(res.error);
            }
          });
        }}
        options={(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => ({ value: l, label: LOCALE_LABELS[l], disabled: pending }))}
      />
      <p className="text-sm text-ink-3">
        Gilt für E-Mails und Benachrichtigungen an dich. Die App selbst ist vorerst auf Deutsch.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------- Dieses Gerät */

const STATE_TEXT: Record<PushState, { title: string; text: string }> = {
  enabled: { title: "Eingeschaltet", text: "Dieses Gerät erhält Benachrichtigungen." },
  disabled: { title: "Ausgeschaltet", text: "Schalte ein, damit du Neuigkeiten sofort auf diesem Gerät siehst." },
  denied: { title: "Im Browser blockiert", text: "Du hast Benachrichtigungen für Standchef blockiert. Erlaube sie in den Einstellungen des Browsers bzw. des Telefons (Website-Einstellungen → Benachrichtigungen) und lade die Seite neu." },
  unsupported: { title: "Nicht möglich", text: "Dieser Browser unterstützt keine Push-Benachrichtigungen. Du erhältst wichtige Nachrichten weiterhin per E-Mail." },
  "ios-needs-install": { title: "Erst zum Home-Bildschirm hinzufügen", text: "Auf iPhone und iPad funktionieren Benachrichtigungen nur, wenn Standchef als App auf dem Home-Bildschirm liegt (ab iOS 16.4)." },
  "not-configured": { title: "Noch nicht verfügbar", text: "Push-Benachrichtigungen sind auf diesem Server noch nicht eingerichtet. Du erhältst wichtige Nachrichten per E-Mail." },
};

export function DeviceCard({ configured, devices }: { configured: boolean; devices: number }) {
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
      if (on && next === "enabled") toast.success("Benachrichtigungen eingeschaltet.");
      else if (on && next === "denied") toast.error("Benachrichtigungen wurden nicht erlaubt.");
      else if (!on) toast.success("Auf diesem Gerät ausgeschaltet.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  }

  const info = state ? STATE_TEXT[state] : null;
  const canToggle = state === "enabled" || state === "disabled";
  const otherDevices = Math.max(0, devices - (state === "enabled" ? 1 : 0));

  return (
    <Card className="animate-rise p-4 space-y-4">
      {!state ? (
        <div className="flex items-center gap-2 text-sm text-ink-3"><Spinner /> Gerät wird geprüft…</div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span className={state === "enabled" ? "mt-0.5 text-ok" : "mt-0.5 text-ink-3"} aria-hidden>
              {state === "enabled" ? <Bell className="h-5 w-5" /> : state === "ios-needs-install" ? <Smartphone className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              {canToggle ? (
                <Switch
                  label="Push-Benachrichtigungen"
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
                  ? `Eingeschaltet auf diesem und ${otherDevices} ${otherDevices === 1 ? "weiteren Gerät" : "weiteren Geräten"}.`
                  : "Nur auf diesem Gerät eingeschaltet."
                : `Auf ${devices} ${devices === 1 ? "anderem Gerät" : "anderen Geräten"} eingeschaltet.`}
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
                  if (res.ok) toast.success(res.message ?? "Gesendet.");
                  else toast.error(res.error);
                })
              }
            >
              {testing ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />} Testbenachrichtigung senden
            </Button>
          ) : null}
        </>
      )}
    </Card>
  );
}

function IosInstallSteps() {
  return (
    <Alert tone="info" title="So geht’s auf dem iPhone">
      <ol className="mt-1 list-decimal space-y-1 pl-5">
        <li>
          In Safari unten auf <Share className="inline h-4 w-4 align-[-2px]" aria-label="Teilen" /> «Teilen» tippen.
        </li>
        <li>
          <SquarePlus className="inline h-4 w-4 align-[-2px]" aria-hidden /> «Zum Home-Bildschirm» wählen.
        </li>
        <li>Standchef vom Home-Bildschirm aus öffnen und hier einschalten.</li>
      </ol>
    </Alert>
  );
}

/* ------------------------------------------------------------------ Themen */

export function TopicsCard({ prefs, email }: { prefs: PreferenceMatrix; email: string }) {
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
          const info = TOPIC_INFO[topic];
          const locked = LOCKED_EMAIL_TOPICS.has(topic);
          return (
            <div key={topic} className="p-4">
              <p className="font-medium">{info.label}</p>
              <p className="text-sm text-ink-3">{info.hint}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Switch
                  label={<span className="inline-flex items-center gap-1.5 text-sm"><Bell className="h-4 w-4 text-ink-3" aria-hidden /> Push</span>}
                  checked={values[topic].push}
                  onChange={(v) => change(topic, "push", v)}
                />
                <Switch
                  label={<span className="inline-flex items-center gap-1.5 text-sm"><Mail className="h-4 w-4 text-ink-3" aria-hidden /> E-Mail</span>}
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
        E-Mails gehen an {email}. Chat-Nachrichten stehen aus Datenschutzgründen nie im Wortlaut in einer E-Mail.
      </p>
    </>
  );
}
