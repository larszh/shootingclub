import { describe, expect, it } from "vitest";
import { formatDate, formatIntlDate, upperFirst } from "./core";

const d = new Date("2026-11-10T12:00:00Z");

describe("Datumsformate je Sprache", () => {
  it("Italienisch mit Wochentag mit Punkten wie ohne Wochentag", () => {
    expect(formatDate(d, "it")).toBe("10.11.2026");
    expect(formatDate(d, "it", { weekday: "short" })).not.toContain("/");
    expect(formatDate(d, "it", { weekday: "short" })).toContain("10.11.2026");
    expect(formatIntlDate(d, "it", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })).toBe("martedì 10 novembre");
  });

  it("andere Sprachen unverändert", () => {
    expect(formatDate(d, "de", { weekday: "short" })).toBe(new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(d));
    expect(formatDate(d, "fr")).toBe("10.11.2026");
  });

  it("upperFirst: nur der erste Buchstabe", () => {
    expect(upperFirst("samedi 7 novembre 2026")).toBe("Samedi 7 novembre 2026");
    expect(upperFirst("")).toBe("");
  });
});
