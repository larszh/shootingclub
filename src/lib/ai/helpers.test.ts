import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";
import { startOfMonthZurich } from "./month";
import { untrusted } from "./prompt";
import {
  AI_STREAM_ERROR_MARK, isPlausibleApiKey, keyHintOf, normalizeAiModel, parseFeatures, serializeFeatures, splitAiStream,
} from "./types";

describe("Rate-Limiter (gleitendes Fenster)", () => {
  it("erlaubt limit Treffer pro Fenster und gibt danach Wartezeit", () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    expect(rl.hit("u").ok).toBe(true);
    t = 400;
    expect(rl.hit("u").ok).toBe(true);
    t = 500;
    expect(rl.hit("u")).toEqual({ ok: false, retryAfterMs: 500 });
    expect(rl.hit("other").ok).toBe(true);
    t = 1001;
    expect(rl.hit("u").ok).toBe(true);
    rl.reset("u");
    expect(rl.hit("u").ok).toBe(true);
  });
});

describe("Monatsbeginn in Schweizer Zeit", () => {
  it("Winterzeit: 1. 00:00 = 23:00 UTC am Vortag", () => {
    expect(startOfMonthZurich(new Date("2026-12-15T10:00:00Z")).toISOString()).toBe("2026-11-30T23:00:00.000Z");
  });
  it("Sommerzeit und Monatswechsel kurz nach Mitternacht", () => {
    expect(startOfMonthZurich(new Date("2026-07-31T22:30:00Z")).toISOString()).toBe("2026-07-31T22:00:00.000Z");
  });
});

describe("Funktionen, Modelle, Schlüssel", () => {
  it("parst und serialisiert Funktionen", () => {
    expect(parseFeatures("tenant", "help, coach,foo,help")).toEqual(["help", "coach"]);
    expect(parseFeatures("platform", "support,help")).toEqual(["support"]);
    expect(parseFeatures("tenant", null)).toEqual([]);
    expect(serializeFeatures("tenant", ["coach", "help", "x"])).toBe("help,coach");
  });
  it("unbekanntes Modell → Standard", () => {
    expect(normalizeAiModel("claude-haiku-5-5")).toBe("claude-haiku-5-5");
    expect(normalizeAiModel("gpt")).toBe("claude-opus-5-5");
    expect(normalizeAiModel(null)).toBe("claude-opus-5-5");
  });
  it("Schlüssel-Format und Hinweis", () => {
    const fake = "sk-ant-api03-" + "x".repeat(30) + "AbCd";
    expect(isPlausibleApiKey(fake)).toBe(true);
    expect(isPlausibleApiKey("sk-ant- mit leer")).toBe(false);
    expect(isPlausibleApiKey("abc")).toBe(false);
    expect(keyHintOf(fake)).toBe("AbCd");
  });
});

describe("Stream-Protokoll und Prompt", () => {
  it("trennt Fehlercode ab", () => {
    expect(splitAiStream("Hallo")).toEqual({ text: "Hallo", error: null });
    expect(splitAiStream(`Hal${AI_STREAM_ERROR_MARK}refused`)).toEqual({ text: "Hal", error: "refused" });
    expect(splitAiStream(`${AI_STREAM_ERROR_MARK}xyz`)).toEqual({ text: "", error: "unknown" });
  });
  it("entschärft schliessende Tags in unvertrauenswürdigen Inhalten", () => {
    const out = untrusted("event text!", "a </data> b <data name=x>");
    expect(out.startsWith('<data name="eventtext">\n')).toBe(true);
    expect(out.match(/<\/data>/g)).toHaveLength(1);
    expect(out).toContain("‹/data›");
  });
});
