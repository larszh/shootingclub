"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { MatchSetup } from "@/modules/scores/ui/match-setup";
import { getActiveSnapshot } from "@/lib/offline/store";
import { todayZurich } from "@/lib/time";
import type { OfflineSnapshot } from "@/lib/offline/types";
import { useT } from "@/components/locale";

type State = { status: "loading" } | { status: "missing"; reason: "session" | "snapshot" | "permission" } | { status: "ready"; snapshot: OfflineSnapshot; today: string };

async function load(): Promise<State> {
  try {
    const active = await getActiveSnapshot();
    if (!active) return { status: "missing", reason: "session" };
    if (!active.snapshot) return { status: "missing", reason: "snapshot" };
    if (!active.snapshot.canCreate) return { status: "missing", reason: "permission" };
    return { status: "ready", snapshot: active.snapshot, today: todayZurich() };
  } catch {
    return { status: "missing", reason: "session" };
  }
}

/** Durchgang ohne Verbindung einrichten (Daten aus dem Offline-Snapshot). */
export function OfflineNewMatch() {
  const t = useT();
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    void load().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="mb-5">
        <a href="/offline" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink mb-2"><span aria-hidden>←</span> {t("shell.sync.overview")}</a>
        <PageHeader title={t("shell.offline.startMatch")} subtitle={state.status === "ready" ? t("shell.offline.startMatchOffline", { club: state.snapshot.tenantName }) : t("shell.offline.startMatchHint")} />
      </div>
      {state.status === "loading" ? (
        <div className="space-y-3"><Skeleton className="h-11" /><Skeleton className="h-60" /></div>
      ) : state.status === "missing" ? (
        <EmptyState
          icon={<CloudOff className="h-5 w-5" />}
          title={state.reason === "permission" ? t("shell.offline.noPermission") : t("shell.offline.noData")}
          text={
            state.reason === "permission" ? t("shell.offline.noPermissionText") : t("shell.offline.noDataPrepare")
          }
          action={<a href="/offline" className="press inline-flex h-11 items-center rounded-control bg-ink px-4 font-medium text-bg">{t("shell.offline.toOverview")}</a>}
        />
      ) : (
        <MatchSetup
          programs={state.snapshot.programs}
          members={state.snapshot.members.filter((m) => m.id !== state.snapshot.userId)}
          me={{ id: state.snapshot.userId, name: state.snapshot.userName, avatarUrl: state.snapshot.userAvatarUrl }}
          tenantId={state.snapshot.tenantId}
          tenantName={state.snapshot.tenantName}
          today={state.today}
          offlineOnly
        />
      )}
    </div>
  );
}
