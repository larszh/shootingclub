"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudOff, CloudUpload, Crosshair, Plus, RefreshCw, Wifi } from "lucide-react";
import { Badge, Card, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/i18n/core";
import { useLocale, useT } from "@/components/locale";
import { useSyncEvents, useSyncStatus } from "@/lib/offline/hooks";
import { flushOutbox } from "@/lib/offline/outbox";
import { getActiveSnapshot, listMatchEntries } from "@/lib/offline/store";
import type { MatchEntry, OfflineSession, OfflineSnapshot, SyncEvent } from "@/lib/offline/types";

type Loaded = { session: OfflineSession | null; snapshot: OfflineSnapshot | null; matches: MatchEntry[] };

async function loadLocal(): Promise<Loaded> {
  try {
    const active = await getActiveSnapshot();
    if (!active) return { session: null, snapshot: null, matches: [] };
    const matches = await listMatchEntries(active.session.userId);
    // Durchgänge anderer Vereine nur zeigen, solange sie noch nicht übertragen sind (nichts verstecken, was aussteht)
    const pending = (m: MatchEntry) => Object.keys(m.dirty).length > 0 || !!m.statusDirty || m.key.startsWith("c:");
    return { session: active.session, snapshot: active.snapshot, matches: matches.filter((m) => !active.session.tenantId || m.tenantId === active.session.tenantId || pending(m)) };
  } catch {
    return { session: null, snapshot: null, matches: [] };
  }
}

/** Link «Übersicht» in der Kopfzeile der Offline-Seiten (übersetzt). */
export function OfflineOverviewLink() {
  const t = useT();
  return (
    <a href="/offline" className="press inline-flex h-10 items-center rounded-full px-3 text-sm font-medium text-ink-2 hover:bg-surface-2">{t("shell.sync.overview")}</a>
  );
}

/** Übersicht ohne Verbindung: was ist auf dem Gerät gespeichert, was wartet auf Übertragung. */
export function OfflineHome() {
  const t = useT();
  const locale = useLocale();
  const status = useSyncStatus();
  const [data, setData] = useState<Loaded | null>(null);

  const reload = useCallback(() => {
    void loadLocal().then(setData);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  const onEvent = useCallback(
    (ev: SyncEvent) => {
      if (ev.type === "changed" || ev.type === "snapshot" || ev.type === "mapped" || ev.type === "flushed") reload();
    },
    [reload],
  );
  useSyncEvents(onEvent);

  return (
    <div className="space-y-6">
      <div className="animate-rise text-center pt-4">
        <div className={cn("mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full", status.online ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn")}>
          {status.online ? <Wifi className="h-7 w-7" /> : <CloudOff className="h-7 w-7 animate-float" />}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{status.online ? t("shell.offline.reconnected") : t("shell.offline.title")}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-3">
          {status.online ? t("shell.offline.reconnectedText") : t("shell.offline.text")}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- volle Navigation, damit der Service Worker antwortet */}
          <a href="/" className="press inline-flex h-11 items-center gap-2 rounded-control bg-ink px-4 font-medium text-bg">
            <RefreshCw className="h-4 w-4" /> {status.online ? t("shell.offline.toApp") : t("shell.sync.retry")}
          </a>
          {status.online && status.pending > 0 ? (
            <button type="button" onClick={() => void flushOutbox({ force: true })} disabled={status.syncing} className="press inline-flex h-11 items-center gap-2 rounded-control border border-line bg-surface px-4 font-medium disabled:opacity-50">
              <CloudUpload className="h-4 w-4" /> {t("shell.offline.syncNow")}
            </button>
          ) : null}
        </div>
      </div>

      {status.pending > 0 || status.failed > 0 ? (
        <Card className="animate-rise p-4 flex items-center gap-3">
          <CloudUpload className="h-5 w-5 text-ink-2 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">{t(status.pending === 1 ? "shell.offline.waitingOne" : "shell.offline.waitingMany", { count: status.pending })}</div>
            {status.failed > 0 ? <div className="text-accent">{t("shell.offline.failed", { count: status.failed })}</div> : <div className="text-ink-3">{t("shell.offline.nothingLost")}</div>}
          </div>
        </Card>
      ) : null}

      {data === null ? (
        <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : !data.session ? (
        <EmptyState icon={<CloudOff className="h-5 w-5" />} title={t("shell.offline.noDataTitle")} text={t("shell.offline.noDataText")} />
      ) : (
        <>
          <section>
            <SectionTitle
              action={data.snapshot?.canCreate ? (
                <a href="/offline/new" className="press inline-flex h-9 items-center gap-1.5 rounded-control bg-ink px-3 text-sm font-medium text-bg"><Plus className="h-4 w-4" /> {t("shell.offline.newMatch")}</a>
              ) : null}
            >
              {t("shell.offline.matchesOnDevice")}
            </SectionTitle>
            {data.matches.length === 0 ? (
              <EmptyState icon={<Crosshair className="h-5 w-5" />} title={t("shell.offline.noMatchesTitle")} text={data.snapshot ? t("shell.offline.noMatchesText") : t("shell.offline.noMatchesClub")} />
            ) : (
              <Card className="divide-y divide-line overflow-hidden stagger">
                {data.matches.map((m) => {
                  const unsynced = Object.keys(m.dirty).length > 0 || !!m.statusDirty || m.key.startsWith("c:");
                  return (
                    <a key={m.key} href={`/offline/match?key=${encodeURIComponent(m.key)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                      <div className="flex -space-x-2">
                        {m.view.participants.slice(0, 3).map((p) => (
                          <Avatar key={p.id} name={p.name} src={p.avatarUrl} size={32} tone={p.isGuest ? "guest" : "ink"} className="ring-2 ring-surface" />
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{m.view.title ?? m.view.program.name}</div>
                        <div className="text-xs text-ink-3">{formatDate(new Date(m.view.date), locale)} · {t(m.view.participants.length === 1 ? "shell.offline.participantsOne" : "shell.offline.participantsMany", { count: m.view.participants.length })}</div>
                      </div>
                      {unsynced ? <Badge tone="warn">{t("shell.offline.notSynced")}</Badge> : m.status === "FINISHED" ? <Badge tone="ok">{t("shell.offline.finished")}</Badge> : <Badge tone="outline">{t("shell.offline.open")}</Badge>}
                    </a>
                  );
                })}
              </Card>
            )}
          </section>
          {data.snapshot ? (
            <p className="text-center text-xs text-ink-3">
              {t("shell.offline.snapshotInfo", { club: data.snapshot.tenantName, date: formatDate(new Date(data.snapshot.generatedAt), locale, { year: undefined, hour: "2-digit", minute: "2-digit" }) })}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
