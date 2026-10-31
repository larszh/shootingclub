"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { diffLive, formatLiveScore, type LiveRow, type LiveSnapshot } from "@/modules/live/logic";

type Status = "live" | "reconnecting" | "polling" | "expired" | "gone";
type Mark = "up" | "upd" | "new";

/** Zeilen pro Spalte; die Zeilenhöhe (eine Textzeile, ca. 5cqh) ist darauf abgestimmt, dass alle 12 in die Fläche passen. */
const ROWS_PER_COLUMN = 12;
const PAGE_MS = 12_000;
const POLL_MS = 10_000;
const SSE_RETRY_MS = 120_000;
const MARK_MS = 4_000;

// --- Uhr (ausserhalb des Renderns, über useSyncExternalStore) ----------------
const clockFormat = new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit" });
function subscribeClock(cb: () => void) {
  const t = setInterval(cb, 1_000);
  return () => clearInterval(t);
}
const getClock = () => clockFormat.format(new Date());
const getServerClock = () => "";

/** Vollbild-Rangliste für TV/Beamer (dunkel, 16:9 skaliert). Aktualisiert sich per SSE, sonst per Polling. */
export function LiveView({ token, initial, brandColor, logoUrl, showTicker }: { token: string; initial: LiveSnapshot; brandColor: string; logoUrl: string | null; showTicker: boolean }) {
  const [snap, setSnap] = useState<LiveSnapshot>(initial);
  const [status, setStatus] = useState<Status>("live");
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [pageTick, setPageTick] = useState(0);
  const prevRows = useRef<LiveRow[]>(initial.rows);
  const clock = useSyncExternalStore(subscribeClock, getClock, getServerClock);

  useEffect(() => {
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const markTimers: Array<ReturnType<typeof setTimeout>> = [];
    let stopped = false;
    let errors = 0;

    const apply = (next: LiveSnapshot) => {
      const d = diffLive(prevRows.current, next.rows);
      prevRows.current = next.rows;
      setSnap(next);
      if (!d.changed) return;
      const m: Record<string, Mark> = {};
      for (const id of d.updated) m[id] = "upd";
      for (const id of d.movedUp) m[id] = "up";
      for (const id of d.added) m[id] = "new";
      if (Object.keys(m).length) {
        setMarks(m);
        markTimers.push(setTimeout(() => setMarks({}), MARK_MS));
      }
    };
    const stopAll = () => {
      stopped = true;
      es?.close();
      if (pollTimer) clearInterval(pollTimer);
      if (retryTimer) clearTimeout(retryTimer);
    };
    const finish = (s: "expired" | "gone") => {
      setStatus(s);
      stopAll();
    };

    const poll = async () => {
      try {
        const r = await fetch(`/api/live/${encodeURIComponent(token)}`, { cache: "no-store" });
        if (r.status === 410) return finish("expired");
        if (r.status === 404) return finish("gone");
        if (!r.ok) return;
        const j = (await r.json()) as { snapshot?: LiveSnapshot };
        if (j.snapshot && !stopped) apply(j.snapshot);
      } catch {
        // offline: beim nächsten Durchlauf erneut
      }
    };
    const startPolling = () => {
      if (stopped || pollTimer) return;
      setStatus("polling");
      void poll();
      pollTimer = setInterval(() => void poll(), POLL_MS);
      // Später erneut eine Live-Verbindung versuchen
      retryTimer = setTimeout(() => {
        if (stopped) return;
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
        connect();
      }, SSE_RETRY_MS);
    };
    function connect() {
      if (stopped) return;
      if (typeof EventSource === "undefined") return startPolling();
      errors = 0;
      es = new EventSource(`/api/live/${encodeURIComponent(token)}/stream`);
      es.addEventListener("snapshot", (e) => {
        errors = 0;
        setStatus("live");
        try {
          apply(JSON.parse((e as MessageEvent<string>).data) as LiveSnapshot);
        } catch {
          // ungültige Nachricht ignorieren
        }
      });
      es.addEventListener("expired", () => finish("expired"));
      es.addEventListener("gone", () => finish("gone"));
      es.onerror = () => {
        errors += 1;
        if (!es || es.readyState === EventSource.CLOSED || errors >= 3) {
          es?.close();
          es = null;
          startPolling();
        } else {
          setStatus("reconnecting");
        }
      };
    }

    connect();
    return () => {
      stopAll();
      for (const t of markTimers) clearTimeout(t);
    };
  }, [token]);

  useEffect(() => {
    const t = setInterval(() => setPageTick((n) => n + 1), PAGE_MS);
    return () => clearInterval(t);
  }, []);

  if (status === "expired" || status === "gone") {
    return (
      <Screen>
        <div className="flex h-full flex-col items-center justify-center px-[6cqw] text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="mb-[4cqh] h-[14cqh] w-auto object-contain" />
          ) : null}
          <div className="text-[3cqh] uppercase tracking-[0.2em] text-white/50">{snap.clubName}</div>
          <h1 className="mt-[2cqh] text-[7cqh] font-bold leading-tight">{status === "expired" ? "Die Live-Rangliste ist beendet" : "Dieser Link ist nicht mehr gültig"}</h1>
          <p className="mt-[2cqh] max-w-[60cqw] text-[3.2cqh] text-white/60">
            {status === "expired" ? "Vielen Dank fürs Mitmachen! Die definitive Rangliste gibt es beim Verein." : "Bitte beim Verein den aktuellen Link für die Live-Rangliste verlangen."}
          </p>
        </div>
      </Screen>
    );
  }

  const rows = snap.rows;
  const twoCols = rows.length > ROWS_PER_COLUMN;
  const perPage = twoCols ? ROWS_PER_COLUMN * 2 : ROWS_PER_COLUMN;
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const page = pageTick % pages;
  const visible = rows.slice(page * perPage, page * perPage + perPage);
  const columns = twoCols ? [visible.slice(0, ROWS_PER_COLUMN), visible.slice(ROWS_PER_COLUMN)] : [visible];

  return (
    <Screen>
      <div className="flex h-full flex-col px-[2.5cqw] pt-[2.5cqh] pb-[2cqh]">
        <header className="flex items-center gap-[2cqw]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-[11cqh] w-auto max-w-[14cqw] shrink-0 object-contain" />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[2.6cqh] uppercase tracking-[0.18em] text-white/55">{snap.clubName}</div>
            <h1 className="truncate text-[6cqh] font-bold leading-[1.1]">{snap.title}</h1>
            <div className="truncate text-[2.8cqh] text-white/65">{snap.subtitle}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[6cqh] font-semibold tabular-nums leading-none" suppressHydrationWarning>{clock}</div>
            <div className="mt-[1cqh] flex items-center justify-end gap-[0.6cqw] text-[2.4cqh] text-white/70" aria-live="polite">
              <span className={`inline-block h-[1.6cqh] w-[1.6cqh] rounded-full ${status === "live" ? "animate-pulse bg-[#3ccf6e]" : status === "polling" ? "bg-[#e0b341]" : "bg-[#e0b341] animate-pulse"}`} aria-hidden />
              {status === "live" ? "LIVE" : status === "polling" ? "Aktualisierung alle 10 s" : "Verbinde…"}
            </div>
          </div>
        </header>
        <div className="mt-[1.6cqh] h-[0.6cqh] rounded-full" style={{ background: brandColor }} aria-hidden />

        <main className="mt-[1.6cqh] min-h-0 flex-1">
          {rows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="text-[5cqh] font-semibold">Noch keine Resultate</div>
              <div className="mt-[1cqh] text-[3cqh] text-white/60">Sobald geschossen wird, erscheint hier die Rangliste.</div>
            </div>
          ) : (
            <div className={`grid h-full grid-rows-[minmax(0,1fr)] gap-x-[2cqw] ${twoCols ? "grid-cols-2" : "grid-cols-1"}`}>
              {columns.map((col, ci) => (
                <ol key={ci} className="grid h-full min-h-0 gap-[0.8cqh] overflow-hidden" style={{ gridTemplateRows: `repeat(${ROWS_PER_COLUMN}, minmax(0, 1fr))` }}>
                  {col.map((r) => (
                    <LiveRowView key={r.id} r={r} decimals={snap.showDecimals} mark={marks[r.id]} brandColor={brandColor} compact={twoCols} />
                  ))}
                </ol>
              ))}
            </div>
          )}
        </main>

        <footer className="mt-[1.4cqh] flex h-[5.5cqh] items-center gap-[1.5cqw] text-[2.6cqh] text-white/70">
          {showTicker && snap.ticker.length ? (
            <>
              <span className="shrink-0 rounded-[0.6cqh] px-[0.8cqw] py-[0.3cqh] text-[2.2cqh] font-semibold uppercase tracking-wider text-white" style={{ background: brandColor }}>Letzte Schüsse</span>
              <div className="flex min-w-0 flex-1 gap-[2.2cqw] overflow-hidden whitespace-nowrap">
                {snap.ticker.map((t) => (
                  <span key={t.id} className="shrink-0">
                    <span className="text-white">{t.name}</span> · {t.stage} · <span className="font-semibold tabular-nums text-white">{formatLiveScore(t.value, snap.showDecimals || !Number.isInteger(t.value))}</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <span className="flex-1" />
          )}
          {pages > 1 ? <span className="shrink-0 tabular-nums">Seite {page + 1}/{pages}</span> : null}
          <span className="shrink-0 text-white/40">standchef.ch</span>
        </footer>
      </div>
    </Screen>
  );
}

/** 16:9-Fläche, die den Bildschirm füllt; Schriftgrössen in Container-Einheiten (cqh/cqw). */
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#050607] text-white" style={{ colorScheme: "dark" }}>
      <div className="relative overflow-hidden bg-[#0d0f12]" style={{ width: "min(100vw, calc(100vh * 16 / 9))", height: "min(100vh, calc(100vw * 9 / 16))", containerType: "size" }}>
        {children}
      </div>
    </div>
  );
}

function LiveRowView({ r, decimals, mark, brandColor, compact }: { r: LiveRow; decimals: boolean; mark?: Mark; brandColor: string; compact: boolean }) {
  const medal = r.rank === 1 ? "#d4a72c" : r.rank === 2 ? "#b8bcc2" : r.rank === 3 ? "#b07a4a" : null;
  const pct = r.maxShots > 0 ? Math.min(100, (r.shots / r.maxShots) * 100) : 0;
  const markBg = mark === "up" ? "bg-[#1f3a28]" : mark === "new" ? "bg-[#1d2a3d]" : mark === "upd" ? "bg-[#2a2a1c]" : "bg-white/[0.04]";
  // Eine Zeile pro Schütze: 12 Zeilen müssen in die Fläche passen (je ca. 5cqh hoch).
  return (
    <li className={`flex min-h-0 items-center gap-[1.2cqw] overflow-hidden rounded-[1cqh] px-[1.2cqw] transition-colors duration-700 ${markBg}`}>
      <span
        className="flex aspect-square h-[80%] max-h-[4.6cqh] shrink-0 items-center justify-center rounded-full text-[2.6cqh] font-bold tabular-nums leading-none"
        style={medal ? { background: medal, color: r.rank === 3 ? "#fff" : "#000" } : { background: "rgba(255,255,255,0.08)" }}
      >
        {r.rank}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-[1cqw]">
        <div className={`min-w-0 truncate font-semibold leading-tight ${compact ? "text-[3cqh]" : "text-[3.6cqh]"}`}>
          {r.name}
          {r.isGuest ? <span className="ml-[0.6cqw] text-[2cqh] font-normal text-white/50">Gast</span> : null}
          {mark === "up" ? <span className="ml-[0.6cqw] text-[2.4cqh] text-[#3ccf6e]" aria-label="aufgestiegen">▲</span> : null}
        </div>
        {!r.finished || r.program ? (
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-[0.8cqw] text-[2cqh] leading-none text-white/55">
            {r.program ? <span className={`truncate ${compact ? "max-w-[8cqw]" : "max-w-[16cqw]"}`}>{r.program}</span> : null}
            {!r.finished ? (
              <>
                <span className="shrink-0" style={{ color: brandColor }}>● läuft</span>
                {r.maxShots > 0 ? (
                  <span className={`relative h-[0.8cqh] shrink-0 overflow-hidden rounded-full bg-white/10 ${compact ? "w-[5cqw]" : "w-[8cqw]"}`} aria-label={`${r.shots} von ${r.maxShots} Schüssen`}>
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: brandColor }} />
                  </span>
                ) : null}
                <span className="shrink-0 tabular-nums">{r.shots}{r.maxShots ? `/${r.maxShots}` : ""}</span>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      <span className={`shrink-0 font-bold tabular-nums leading-none ${compact ? "text-[3.6cqh]" : "text-[4.4cqh]"} ${r.finished ? "" : "text-white/80"}`}>{formatLiveScore(r.total, decimals)}</span>
    </li>
  );
}
