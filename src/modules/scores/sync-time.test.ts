import { describe, expect, it } from "vitest";
import { clampClientTime, incomingWins, MAX_CLIENT_SKEW_MS } from "./sync-time";

const now = Date.UTC(2026, 9, 29, 12, 0, 0);

describe("clampClientTime", () => {
  it("übernimmt plausible Gerätezeiten (Zahl, Text, Date)", () => {
    expect(clampClientTime(now - 1000, now).getTime()).toBe(now - 1000);
    expect(clampClientTime("2026-10-29T11:00:00Z", now).toISOString()).toBe("2026-10-29T11:00:00.000Z");
    expect(clampClientTime(new Date(now - 5), now).getTime()).toBe(now - 5);
  });

  it("kappt Zeiten in der Zukunft auf jetzt + 5 Minuten", () => {
    expect(clampClientTime(now + 60 * 60_000, now).getTime()).toBe(now + MAX_CLIENT_SKEW_MS);
  });

  it("ersetzt fehlende, ungültige und uralte Zeiten durch jetzt", () => {
    expect(clampClientTime(undefined, now).getTime()).toBe(now);
    expect(clampClientTime("kaputt", now).getTime()).toBe(now);
    expect(clampClientTime(Number.NaN, now).getTime()).toBe(now);
    expect(clampClientTime(Date.UTC(2019, 11, 31), now).getTime()).toBe(now);
  });
});

describe("incomingWins (last-write-wins)", () => {
  it("neuer oder gleich alt gewinnt, älter verliert", () => {
    const t = new Date(now);
    expect(incomingWins(null, t)).toBe(true);
    expect(incomingWins(new Date(now - 1), t)).toBe(true);
    expect(incomingWins(new Date(now), t)).toBe(true);
    expect(incomingWins(new Date(now + 1), t)).toBe(false);
  });
});
