import { describe, expect, it } from "vitest";
import { clipText, contentHash, fieldStatus, localeStatus, localesToTranslate, pickDisplay, type TranslationRowLite } from "./logic";
import { targetLocales, targetsLabel } from "./entities";

const row = (field: string, locale: string, source: string, value = `${field}-${locale}`, status = "AUTO"): TranslationRowLite => ({
  field, locale, value, sourceHash: contentHash(source), status,
});

describe("contentHash / Staleness", () => {
  it("ist stabil gegenüber Zeilenenden und Rand-Leerraum", () => {
    expect(contentHash("Hallo\r\nWelt  ")).toBe(contentHash("Hallo\nWelt"));
    expect(contentHash("Hallo")).toMatch(/^[0-9a-f]{64}$/);
    expect(contentHash("Hallo")).not.toBe(contentHash("Hallo!"));
  });

  it("erkennt fehlende, aktuelle und veraltete Übersetzungen", () => {
    expect(fieldStatus(null, "Text")).toBe("missing");
    expect(fieldStatus(row("title", "fr", "Text"), "Text")).toBe("fresh");
    expect(fieldStatus(row("title", "fr", "Text"), "Text geändert")).toBe("stale");
    expect(fieldStatus(row("title", "fr", "x"), "")).toBe("empty");
    expect(fieldStatus({ sourceHash: contentHash("Text"), value: "  " }, "Text")).toBe("missing");
  });

  it("Status pro Sprache über alle Felder", () => {
    const sources = { title: "Training", description: "Mitnehmen: Gehörschutz" };
    const fr = [row("title", "fr", "Training"), row("description", "fr", "Mitnehmen: Gehörschutz")];
    expect(localeStatus(fr, sources, "fr")).toBe("fresh");
    expect(localeStatus(fr.slice(0, 1), sources, "fr")).toBe("partial");
    expect(localeStatus([row("title", "fr", "Training alt"), fr[1]!], sources, "fr")).toBe("stale");
    expect(localeStatus([], sources, "it")).toBe("missing");
    // leeres Feld zählt nicht
    expect(localeStatus(fr.slice(0, 1), { title: "Training", description: "" }, "fr")).toBe("fresh");
  });

  it("übersetzt nur fehlende/veraltete Sprachen (force: alle)", () => {
    const sources = { title: "Training" };
    const rows = [row("title", "fr", "Training"), row("title", "it", "Training alt")];
    expect(localesToTranslate(rows, sources, ["fr", "it", "en"])).toEqual(["it", "en"]);
    expect(localesToTranslate(rows, sources, ["fr", "it", "en"], true)).toEqual(["fr", "it", "en"]);
    expect(localesToTranslate(rows, { title: " " }, ["fr"])).toEqual([]);
  });
});

describe("pickDisplay", () => {
  const sources = { title: "Endschiessen", body: "Wir treffen uns um 18:00 Uhr." };
  const rows = [row("title", "fr", sources.title, "Tir de clôture"), row("body", "fr", sources.body, "Rendez-vous à 18:00.")];

  it("zeigt die aktuelle Übersetzung in der Sprache des Mitglieds", () => {
    const d = pickDisplay({ viewerLocale: "fr", sourceLocale: "de", sources, rows });
    expect(d).toEqual({ fields: { title: "Tir de clôture", body: "Rendez-vous à 18:00." }, translated: true, reviewed: false });
  });

  it("Original bei gleicher Sprache, auf Wunsch, oder ohne Übersetzung", () => {
    expect(pickDisplay({ viewerLocale: "de", sourceLocale: "de", sources, rows }).translated).toBe(false);
    expect(pickDisplay({ viewerLocale: "fr", sourceLocale: "de", sources, rows, original: true }).fields).toEqual(sources);
    expect(pickDisplay({ viewerLocale: "it", sourceLocale: "de", sources, rows }).translated).toBe(false);
  });

  it("nie gemischt: ein veraltetes oder fehlendes Feld → Original", () => {
    const changed = { ...sources, body: "Wir treffen uns um 19:00 Uhr." };
    const d = pickDisplay({ viewerLocale: "fr", sourceLocale: "de", sources: changed, rows });
    expect(d).toEqual({ fields: changed, translated: false, reviewed: false });
    expect(pickDisplay({ viewerLocale: "fr", sourceLocale: "de", sources, rows: rows.slice(0, 1) }).translated).toBe(false);
  });

  it("leere Quellfelder bleiben leer, reviewed nur wenn alles geprüft", () => {
    const d = pickDisplay({ viewerLocale: "en", sourceLocale: "de", sources: { title: "Training", description: null }, rows: [row("title", "en", "Training", "Training session", "REVIEWED")] });
    expect(d).toEqual({ fields: { title: "Training session", description: null }, translated: true, reviewed: true });
  });
});

describe("entities / clipText", () => {
  it("Zielsprachen ohne Quellsprache", () => {
    expect(targetLocales("de")).toEqual(["fr", "it", "en"]);
    expect(targetLocales("fr")).toEqual(["de", "it", "en"]);
    expect(targetsLabel("de")).toBe("FR/IT/EN");
  });
  it("kürzt an Zeichengrenzen", () => {
    expect(clipText("Grüezi 👋 mitenand", 8)).toBe("Grüezi 👋");
    expect(clipText("kurz", 10)).toBe("kurz");
  });
});
