/** Gleitendes Zeitfenster im Speicher (eine PM2-Instanz): höchstens `limit` Treffer pro `windowMs`. */
export type RateLimiter = {
  /** Zählt einen Treffer. ok=false: Limit erreicht, retryAfterMs bis zum nächsten freien Platz. */
  hit(key: string): { ok: true } | { ok: false; retryAfterMs: number };
  reset(key?: string): void;
};

export function createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number; maxKeys?: number }): RateLimiter {
  const now = opts.now ?? Date.now;
  const maxKeys = opts.maxKeys ?? 10_000;
  const hits = new Map<string, number[]>();
  return {
    hit(key) {
      const t = now();
      const since = t - opts.windowMs;
      if (hits.size > maxKeys) {
        for (const [k, arr] of hits) if ((arr.at(-1) ?? 0) <= since) hits.delete(k);
      }
      const arr = (hits.get(key) ?? []).filter((x) => x > since);
      if (arr.length >= opts.limit) {
        hits.set(key, arr);
        return { ok: false, retryAfterMs: Math.max(1, arr[0]! + opts.windowMs - t) };
      }
      arr.push(t);
      hits.set(key, arr);
      return { ok: true };
    },
    reset(key) {
      if (key === undefined) hits.clear();
      else hits.delete(key);
    },
  };
}
