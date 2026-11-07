"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useState, useTransition } from "react";
import { CalendarPlus, RefreshCw, Rss } from "lucide-react";
import { Alert, Button, Card } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import type { ActionResult } from "@/lib/action-result";
import { isNetworkError } from "@/lib/ui-feedback";
import { getT, type Locale } from "@/lib/i18n/core";
import { localizeMessage } from "@/modules/billing/ui/i18n";
import { ensureMyFeedAction, ensureTenantFeedAction, regenerateMyFeedAction, regenerateTenantFeedAction, type FeedLink } from "../actions";
import { webcalUrl } from "../types";
import { CopyField } from "./copy-field";

function FeedBlock({ title, text, initialUrl, ensure, regenerate, regenerateLabel, locale = "de" }: {
  title: string;
  text: string;
  initialUrl: string | null;
  ensure: () => Promise<ActionResult<FeedLink>>;
  regenerate?: () => Promise<ActionResult<FeedLink>>;
  regenerateLabel?: string;
  locale?: Locale;
}) {
  const t = getT(locale);
  const [url, setUrl] = useState(initialUrl);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(fn: () => Promise<ActionResult<FeedLink>>) {
    setMsg(null);
    start(async () => {
      let r: ActionResult<FeedLink>;
      try {
        r = await fn();
      } catch (err) {
        setMsg({ ok: false, text: isNetworkError(err) ? t("money.err.offline") : t("money.err.generic") });
        return;
      }
      if (r.ok && r.data) {
        setUrl(r.data.url);
        if (r.message) setMsg({ ok: true, text: localizeMessage(r.message, locale) });
      } else if (!r.ok) setMsg({ ok: false, text: localizeMessage(r.error, locale) });
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
            <CalendarPlus className="h-4 w-4" /> {t("money.cal.subscribeApp")}
          </a>
          <CopyField value={url} label={t("money.cal.linkLabel", { title })} locale={locale} />
          {regenerate ? (
            <Button type="button" variant="ghost" size="sm" disabled={pending}
              onClick={async () => { if ((await confirmDialog({ title: t("money.cal.regenTitle"), message: t("money.cal.regenMessage"), tone: "danger", confirmLabel: t("money.cal.regenConfirm") }))) run(regenerate); }}>
              {pending ? <Spinner /> : <RefreshCw className="h-4 w-4" />} {regenerateLabel ?? t("money.cal.regenButton")}
            </Button>
          ) : null}
        </>
      ) : (
        <Button type="button" variant="secondary" className="w-full" disabled={pending} onClick={() => run(ensure)}>
          {pending ? <Spinner /> : <Rss className="h-4 w-4" />} {t("money.cal.create")}
        </Button>
      )}
      {msg ? <Alert tone={msg.ok ? "ok" : "error"}>{msg.text}</Alert> : null}
    </div>
  );
}

/** «Kalender abonnieren» auf /events: Vereinskalender und persönliche Termine. */
export function CalendarSubscribe({ tenantName, tenantFeedUrl, userFeedUrl, locale = "de" }: { tenantName: string; tenantFeedUrl: string | null; userFeedUrl: string | null; locale?: Locale }) {
  const t = getT(locale);
  return (
    <Card className="p-4 space-y-5">
      <p className="text-sm text-ink-2">
        {t("money.cal.intro")}
      </p>
      <FeedBlock locale={locale} title={t("money.cal.tenantTitle", { club: tenantName })} text={t("money.cal.tenantText")} initialUrl={tenantFeedUrl} ensure={ensureTenantFeedAction} />
      <div className="border-t border-line pt-5">
        <FeedBlock locale={locale} title={t("money.cal.myTitle")} text={t("money.cal.myText")}
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
