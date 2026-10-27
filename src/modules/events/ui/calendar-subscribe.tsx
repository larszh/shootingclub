"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useState, useTransition } from "react";
import { CalendarPlus, RefreshCw, Rss } from "lucide-react";
import { Alert, Button, Card } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import type { ActionResult } from "@/lib/action-result";
import { ensureMyFeedAction, ensureTenantFeedAction, regenerateMyFeedAction, regenerateTenantFeedAction, type FeedLink } from "../actions";
import { webcalUrl } from "../types";
import { CopyField } from "./copy-field";

function FeedBlock({ title, text, initialUrl, ensure, regenerate, regenerateLabel }: {
  title: string;
  text: string;
  initialUrl: string | null;
  ensure: () => Promise<ActionResult<FeedLink>>;
  regenerate?: () => Promise<ActionResult<FeedLink>>;
  regenerateLabel?: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(fn: () => Promise<ActionResult<FeedLink>>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.ok && r.data) {
        setUrl(r.data.url);
        if (r.message) setMsg({ ok: true, text: r.message });
      } else if (!r.ok) setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className="space-y-2.5">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-ink-3">{text}</p>
      </div>
      {url ? (
        <>
          <a href={webcalUrl(url)} className="press flex h-11 items-center justify-center gap-2 rounded-control bg-ink px-4 text-[15px] font-medium text-bg hover:opacity-90">
            <CalendarPlus className="h-4 w-4" /> In Kalender-App abonnieren
          </a>
          <CopyField value={url} label={`${title} – Link`} />
          {regenerate ? (
            <Button type="button" variant="ghost" size="sm" disabled={pending}
              onClick={async () => { if ((await confirmDialog({ title: "Neuen Link erzeugen? Der bisherige Link funktioniert danach nicht mehr.", tone: "danger" }))) run(regenerate); }}>
              {pending ? <Spinner /> : <RefreshCw className="h-4 w-4" />} {regenerateLabel ?? "Neuen Link erzeugen"}
            </Button>
          ) : null}
        </>
      ) : (
        <Button type="button" variant="secondary" className="w-full" disabled={pending} onClick={() => run(ensure)}>
          {pending ? <Spinner /> : <Rss className="h-4 w-4" />} Link erstellen
        </Button>
      )}
      {msg ? <Alert tone={msg.ok ? "ok" : "error"}>{msg.text}</Alert> : null}
    </div>
  );
}

/** «Kalender abonnieren» auf /events: Vereinskalender und persönliche Termine. */
export function CalendarSubscribe({ tenantName, tenantFeedUrl, userFeedUrl }: { tenantName: string; tenantFeedUrl: string | null; userFeedUrl: string | null }) {
  return (
    <Card className="p-4 space-y-5">
      <p className="text-sm text-ink-2">
        Abonniere die Termine in Google Kalender, Apple Kalender oder Outlook. Neue und geänderte Anlässe erscheinen dann automatisch.
        Der Link ist geheim: Wer ihn kennt, sieht die Termine.
      </p>
      <FeedBlock title={`Alle Anlässe von ${tenantName}`} text="Der ganze Vereinskalender, inklusive Absagen." initialUrl={tenantFeedUrl} ensure={ensureTenantFeedAction} />
      <div className="border-t border-line pt-5">
        <FeedBlock title="Meine Termine" text="Anlässe, für die du zugesagt oder «vielleicht» gesagt hast, und deine Reservationen – aus allen deinen Vereinen."
          initialUrl={userFeedUrl} ensure={ensureMyFeedAction} regenerate={regenerateMyFeedAction} />
      </div>
    </Card>
  );
}

/** Verwaltung: Vereins-Feed anzeigen und erneuern (nur Admins). */
export function TenantFeedAdmin({ tenantFeedUrl }: { tenantFeedUrl: string | null }) {
  return (
    <Card className="p-4">
      <FeedBlock title="Öffentlicher Kalender-Link" text="Für Mitglieder, die den Vereinskalender abonnieren. Erzeuge einen neuen Link, falls der alte in falsche Hände geraten ist."
        initialUrl={tenantFeedUrl} ensure={ensureTenantFeedAction} regenerate={regenerateTenantFeedAction} regenerateLabel="Link erneuern" />
    </Card>
  );
}
