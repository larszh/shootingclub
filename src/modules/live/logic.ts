/**
 * Live-Rangliste: reine Logik (Namen kürzen, Rangierung, Unterschiede erkennen).
 * Ohne DB und ohne "server-only", läuft auf Server und im Browser (getestet in logic.test.ts).
 */

export type LiveRow = {
  /** MatchParticipant.id */
  id: string;
  name: string;
  isGuest: boolean;
  total: number;
  /** abgegebene Schüsse */
  shots: number;
  /** geplante Schüsse des Programms (0 = unbekannt) */
  maxShots: number;
  finished: boolean;
  /** Programmname (wenn die Tafel nicht auf ein Programm beschränkt ist) */
  program: string | null;
  rank: number;
};

export type LiveTickerItem = { id: string; name: string; stage: string; value: number; at: string };

export type LiveSnapshot = {
  title: string;
  clubName: string;
  subtitle: string;
  showDecimals: boolean;
  rows: LiveRow[];
  ticker: LiveTickerItem[];
  /** ISO-Zeitpunkt, nur zur Anzeige */
  updatedAt: string;
  expiresAt: string | null;
};

/** Ein Wort ohne Leerzeichen am Rand, Grossbuchstabe am Anfang des Kürzels. */
function initialOf(word: string, len: number) {
  const w = word.replace(/[^\p{L}\p{N}'-]/gu, "");
  if (!w) return "";
  return w.slice(0, len).charAt(0).toUpperCase() + w.slice(1, len);
}

/**
 * «Vorname N.» aus einem vollen Namen («Anna Maria Muster» → «Anna M.»). Ein einzelnes Wort bleibt.
 * `len` = Anzahl Buchstaben des Nachnamens (für Unterscheidung bei gleichen Kürzeln).
 */
export function shortName(full: string, len = 1): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Unbekannt";
  if (parts.length === 1) return parts[0]!.slice(0, 40);
  const first = parts[0]!.slice(0, 30);
  const last = parts[parts.length - 1]!;
  const ini = initialOf(last, len);
  return ini ? `${first} ${ini}.` : first;
}

/**
 * Kürzt eine Liste von Namen und unterscheidet gleiche Kürzel durch weitere Buchstaben des
 * Nachnamens («Anna Mu.», «Anna Me.»). Gleiche volle Namen bleiben gleich.
 */
export function shortNames(fulls: readonly string[]): string[] {
  const lens = fulls.map(() => 1);
  for (let round = 0; round < 12; round++) {
    const out = fulls.map((f, i) => shortName(f, lens[i]));
    const groups = new Map<string, number[]>();
    out.forEach((s, i) => groups.set(s, [...(groups.get(s) ?? []), i]));
    let changed = false;
    for (const idx of groups.values()) {
      if (idx.length < 2) continue;
      const distinctFull = new Set(idx.map((i) => fulls[i]!.trim().toLowerCase()));
      if (distinctFull.size < 2) continue;
      for (const i of idx) {
        const parts = fulls[i]!.trim().split(/\s+/);
        const lastLen = (parts[parts.length - 1] ?? "").length;
        if (parts.length > 1 && lens[i]! < lastLen) {
          lens[i]! += 1;
          changed = true;
        }
      }
    }
    if (!changed) return out;
  }
  return fulls.map((f, i) => shortName(f, lens[i]));
}

/** Gastname so wie erfasst, gekürzt auf eine sinnvolle Länge. */
export function guestDisplayName(name: string | null | undefined) {
  const n = (name ?? "").trim().replace(/\s+/g, " ");
  return n ? n.slice(0, 40) : "Gast";
}

/**
 * Rangierung: höheres Total zuerst; bei Gleichstand gleicher Rang.
 * Reihenfolge innerhalb Gleichstand: abgeschlossene vor laufenden, dann weniger Schüsse, dann Name.
 */
export function rankLiveRows(rows: Array<Omit<LiveRow, "rank">>): LiveRow[] {
  const sorted = [...rows].sort(
    (a, b) => b.total - a.total || Number(b.finished) - Number(a.finished) || a.shots - b.shots || a.name.localeCompare(b.name, "de-CH") || a.id.localeCompare(b.id),
  );
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || sorted[i - 1]!.total !== r.total) rank = i + 1;
    return { ...r, rank };
  });
}

/** Stabiler Schlüssel des Inhalts (ohne Zeitstempel), um nur bei Änderungen zu senden. */
export function snapshotKey(s: LiveSnapshot): string {
  return JSON.stringify([s.title, s.subtitle, s.showDecimals, s.expiresAt, s.rows, s.ticker]);
}

export type LiveDiff = {
  changed: boolean;
  added: string[];
  removed: string[];
  /** Zeilen mit neuem Total oder Status */
  updated: string[];
  /** Rangverbesserungen (für Hervorhebung) */
  movedUp: string[];
  movedDown: string[];
};

/** Unterschiede zwischen zwei Ranglisten (für Hervorhebungen im Browser). */
export function diffLive(prev: readonly LiveRow[] | null, next: readonly LiveRow[]): LiveDiff {
  const before = new Map((prev ?? []).map((r, i) => [r.id, { r, pos: i }]));
  const after = new Map(next.map((r, i) => [r.id, { r, pos: i }]));
  const added: string[] = [];
  const updated: string[] = [];
  const movedUp: string[] = [];
  const movedDown: string[] = [];
  for (const [id, { r, pos }] of after) {
    const old = before.get(id);
    if (!old) {
      if (prev) added.push(id);
      continue;
    }
    if (old.r.total !== r.total || old.r.shots !== r.shots || old.r.finished !== r.finished) updated.push(id);
    if (pos < old.pos) movedUp.push(id);
    else if (pos > old.pos) movedDown.push(id);
  }
  const removed = [...before.keys()].filter((id) => !after.has(id));
  const changed = prev === null || added.length + removed.length + updated.length + movedUp.length + movedDown.length > 0 || prev.some((r, i) => r.name !== next[i]?.name || r.rank !== next[i]?.rank);
  return { changed, added, removed, updated, movedUp, movedDown };
}

/** Punkte für die Anzeige: mit oder ohne Zehntel. */
export function formatLiveScore(n: number, decimals: boolean) {
  return decimals ? (Math.round(n * 10) / 10).toFixed(1) : String(Math.round(n));
}

/** Ist die Tafel abgelaufen? */
export function isExpired(expiresAt: Date | string | null | undefined, now: Date): boolean {
  if (!expiresAt) return false;
  const t = typeof expiresAt === "string" ? Date.parse(expiresAt) : expiresAt.getTime();
  return Number.isFinite(t) && t <= now.getTime();
}

/** Grobe Prüfung eines Tokens aus der URL (vor dem DB-Zugriff). */
export function isPlausibleToken(token: string | null | undefined): token is string {
  return !!token && /^[A-Za-z0-9_-]{20,64}$/.test(token);
}
