import { describe, expect, it } from "vitest";
import type { Locale } from "@/lib/i18n/locales";
import {
  AI_CHUNK_SIZE, buildExportFile, buildRows, checkPlaceholders, chunkForAi, filterRows, filterSuggestions, MAX_VALUE_LENGTH,
  namespaceOf, parseImportFile, placeholdersOf, planChange, validateEntries, validateValue, wordDiff, type DictionaryContext,
} from "./logic";

const BASE: Record<Locale, Record<string, string>> = {
  de: { "a.hello": "Hallo {name}", "a.plain": "Speichern", "b.count": "{n} von {total}", "b.same": "OK", "c.me": " (ich)", "c.tail": "Alle zählen. " },
  fr: { "a.hello": "Salut {name}", "a.plain": "Enregistrer", "b.same": "OK", "c.me": " (moi)", "c.tail": "Tous comptent. " },
  it: { "a.hello": "Ciao {name}", "c.me": " (io)" },
  en: {},
};

function ctx(overrides: Partial<Record<Locale, Record<string, string>>> = {}): DictionaryContext {
  const keys = new Set(Object.values(BASE).flatMap((d) => Object.keys(d)));
  return {
    hasKey: (k) => keys.has(k),
    reference: (l, k) => BASE.de[k] ?? BASE[l][k],
    base: (l, k) => BASE[l][k],
    override: (l, k) => overrides[l]?.[k],
  };
}

describe("placeholders", () => {
  it("extracts unique sorted names", () => {
    expect(placeholdersOf("{b} {a} {b} {not valid} {x1}")).toEqual(["a", "b", "x1"]);
  });
  it("accepts the same set in another order", () => {
    expect(checkPlaceholders("{n} von {total}", "{total} : {n}")).toEqual({ ok: true });
  });
  it("reports missing and extra placeholders", () => {
    expect(checkPlaceholders("Hallo {name}", "Salut {nom}")).toEqual({ ok: false, missing: ["name"], extra: ["nom"] });
    expect(checkPlaceholders("Speichern", "Save {x}")).toEqual({ ok: false, missing: [], extra: ["x"] });
    expect(checkPlaceholders(undefined, "plain")).toEqual({ ok: true });
  });
  it("validateValue uses the German reference", () => {
    expect(validateValue(ctx(), "fr", "a.hello", "Bonjour")).toMatchObject({ code: "placeholders", missing: ["name"] });
    expect(validateValue(ctx(), "fr", "a.hello", "Bonjour {name}")).toBeNull();
    expect(validateValue(ctx(), "fr", "nope", "x")).toMatchObject({ code: "unknownKey" });
    expect(validateValue(ctx(), "fr", "a.plain", 5)).toMatchObject({ code: "notString" });
    expect(validateValue(ctx(), "fr", "a.plain", "x".repeat(MAX_VALUE_LENGTH + 1))).toMatchObject({ code: "tooLong" });
  });
});

describe("planChange", () => {
  it("sets a new override", () => {
    expect(planChange(ctx(), "fr", "a.plain", "  Sauver \r\n ")).toEqual({ key: "a.plain", before: "Enregistrer", after: "Sauver", op: "set" });
  });
  it("resets when empty or equal to the default", () => {
    const c = ctx({ fr: { "a.plain": "Sauver" } });
    expect(planChange(c, "fr", "a.plain", "")).toEqual({ key: "a.plain", before: "Sauver", after: "Enregistrer", op: "reset" });
    expect(planChange(c, "fr", "a.plain", "Enregistrer")?.op).toBe("reset");
  });
  it("returns null without change", () => {
    expect(planChange(ctx(), "fr", "a.plain", "Enregistrer")).toBeNull();
    expect(planChange(ctx(), "fr", "a.plain", "")).toBeNull();
    expect(planChange(ctx({ fr: { "a.plain": "Sauver" } }), "fr", "a.plain", "Sauver")).toBeNull();
  });
  it("keeps the deliberate padding of built-in texts", () => {
    expect(planChange(ctx(), "it", "c.me", " (io)")).toBeNull();
    expect(planChange(ctx(), "it", "c.me", "(io)")).toBeNull();
    expect(planChange(ctx(), "it", "c.me", "(mio)")).toEqual({ key: "c.me", before: " (io)", after: " (mio)", op: "set" });
    expect(planChange(ctx(), "fr", "c.tail", "Tout compte.")?.after).toBe("Tout compte. ");
    // Sprache ohne mitgelieferten Text: Rand des deutschen Textes
    expect(planChange(ctx(), "en", "c.me", "(me)")?.after).toBe(" (me)");
    // früher ohne Leerzeichen gespeicherte Übersteuerung → zurücksetzen
    expect(planChange(ctx({ it: { "c.me": "(io)" } }), "it", "c.me", " (io)")?.op).toBe("reset");
  });
  it("an unchanged 'all' export round-trips without changes", () => {
    for (const l of ["de", "fr", "it", "en"] as const) {
      const entries = Object.entries(BASE[l]).map(([key, value]) => ({ key, value }));
      const res = validateEntries(ctx(), l, entries, { skipEmpty: true });
      expect(res.changes).toEqual([]);
      expect(res.unchanged).toBe(entries.length);
    }
  });
});

describe("import", () => {
  it("parses the export format and checks the locale", () => {
    const file = JSON.stringify(buildExportFile("fr", "overrides", { "b.same": "D'accord", "a.plain": "Sauver" }, new Date("2026-11-07T10:00:00Z")));
    const p = parseImportFile(file, "fr");
    expect(p).toMatchObject({ ok: true, locale: "fr" });
    if (p.ok) expect(p.entries.map((e) => e.key)).toEqual(["a.plain", "b.same"]);
    expect(parseImportFile(file, "it")).toEqual({ ok: false, error: "localeMismatch" });
  });
  it("accepts a flat object and a BOM", () => {
    expect(parseImportFile("﻿{\"a.plain\":\"Salva\"}", "it")).toEqual({ ok: true, locale: null, entries: [{ key: "a.plain", value: "Salva" }] });
  });
  it("rejects broken files", () => {
    expect(parseImportFile("{nope")).toEqual({ ok: false, error: "invalidJson" });
    expect(parseImportFile("[1,2]")).toEqual({ ok: false, error: "invalidShape" });
    expect(parseImportFile(JSON.stringify({ format: "other", entries: {} }))).toEqual({ ok: false, error: "invalidShape" });
    expect(parseImportFile(JSON.stringify({ locale: "xx", entries: {} }))).toEqual({ ok: false, error: "invalidShape" });
    expect(parseImportFile(JSON.stringify({ entries: ["a"] }))).toEqual({ ok: false, error: "invalidShape" });
  });
  it("validates keys and placeholders, skips empty values", () => {
    const res = validateEntries(
      ctx({ fr: { "b.same": "Bien" } }),
      "fr",
      [
        { key: "a.hello", value: "Bonjour {name}" },
        { key: "a.hello", value: "duplicate ignored" },
        { key: "b.count", value: "{n} sur {totl}" },
        { key: "unknown.key", value: "x" },
        { key: "a.plain", value: "Enregistrer" },
        { key: "b.same", value: "" },
        { key: "b.same", value: "never seen" },
        { key: "a.plain2", value: 3 },
      ],
      { skipEmpty: true },
    );
    expect(res.changes).toEqual([{ key: "a.hello", before: "Salut {name}", after: "Bonjour {name}", op: "set" }]);
    expect(res.unchanged).toBe(1);
    expect(res.skipped).toBe(1);
    expect(res.errors.map((e) => [e.key, e.code])).toEqual([
      ["b.count", "placeholders"],
      ["unknown.key", "unknownKey"],
      ["a.plain2", "unknownKey"],
    ]);
  });
  it("empty values reset when not skipping", () => {
    const res = validateEntries(ctx({ fr: { "b.same": "Bien" } }), "fr", [{ key: "b.same", value: " " }, { key: "zz", value: "" }]);
    expect(res.changes).toEqual([{ key: "b.same", before: "Bien", after: "OK", op: "reset" }]);
    expect(res.errors).toEqual([{ key: "zz", code: "unknownKey" }]);
  });
});

describe("chunkForAi", () => {
  const items = (n: number, len = 10) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, source: "x".repeat(len) }));
  it("splits by count", () => {
    const chunks = chunkForAi(items(2 * AI_CHUNK_SIZE + 5));
    expect(chunks.map((c) => c.length)).toEqual([AI_CHUNK_SIZE, AI_CHUNK_SIZE, 5]);
    expect(chunks.flat().map((c) => c.key)).toEqual(items(2 * AI_CHUNK_SIZE + 5).map((c) => c.key));
  });
  it("splits by size and keeps oversized items alone", () => {
    expect(chunkForAi(items(5, 98), 80, 300).map((c) => c.length)).toEqual([3, 2]);
    expect(chunkForAi(items(2, 1000), 80, 300).map((c) => c.length)).toEqual([1, 1]);
    expect(chunkForAi([])).toEqual([]);
  });
});

describe("filterSuggestions", () => {
  it("keeps valid suggestions and reports the rest", () => {
    const ref = (k: string) => BASE.de[k];
    const res = filterSuggestions(
      ["a.hello", "a.plain", "b.count", "b.same"],
      [
        { key: "a.hello", text: " Bonjour {name} " },
        { key: "a.hello", text: "dup" },
        { key: "a.plain", text: "" },
        { key: "b.count", text: "{n} de {total} {extra}" },
        { key: "evil.key", text: "x" },
      ],
      ref,
    );
    expect(res.accepted).toEqual([{ key: "a.hello", text: "Bonjour {name}" }]);
    expect(res.rejected).toEqual([
      { key: "a.plain", reason: "empty" },
      { key: "b.count", reason: "placeholders" },
      { key: "evil.key", reason: "unknown" },
    ]);
    expect(res.missing).toEqual(["b.same"]);
  });
  it("keeps the padding of appended texts", () => {
    const ref = (k: string) => BASE.de[k];
    const res = filterSuggestions(["c.me"], [{ key: "c.me", text: "(moi)" }], ref, (k) => BASE.fr[k]);
    expect(res.accepted).toEqual([{ key: "c.me", text: " (moi)" }]);
  });
});

describe("rows", () => {
  const keys = ["a.hello", "a.plain", "b.count", "b.same"];
  const rows = buildRows(keys, ctx({ it: { "a.plain": "Salva" } }));
  it("computes state and needsWork", () => {
    const plain = rows.find((r) => r.key === "a.plain")!;
    expect(plain.ns).toBe("a");
    expect(plain.cells.it).toMatchObject({ value: "Salva", state: "custom", needsWork: false });
    expect(plain.cells.en).toMatchObject({ value: "", state: "missing", needsWork: true });
    expect(rows.find((r) => r.key === "b.same")!.cells.fr.needsWork).toBe(true);
    expect(rows.find((r) => r.key === "a.hello")!.cells.fr.needsWork).toBe(false);
  });
  it("filters by search, namespace and status", () => {
    const f = (o: Partial<Parameters<typeof filterRows>[1]>) => filterRows(rows, { query: "", ns: "", status: "all", locale: "fr", ...o }).map((r) => r.key);
    expect(f({ query: "salva" })).toEqual(["a.plain"]);
    expect(f({ query: "HALLO name" })).toEqual(["a.hello"]);
    expect(f({ ns: "b" })).toEqual(["b.count", "b.same"]);
    expect(f({ status: "needsWork", locale: "fr" })).toEqual(["b.count", "b.same"]);
    expect(f({ status: "custom", locale: "it" })).toEqual(["a.plain"]);
  });
  it("namespaceOf", () => {
    expect(namespaceOf("adm1.members.title")).toBe("adm1");
    expect(namespaceOf("plain")).toBe("plain");
  });
});

describe("wordDiff", () => {
  it("marks changed words", () => {
    expect(wordDiff("Neuer Anlass erstellt", "Neuer Termin erstellt")).toEqual([
      { type: "same", text: "Neuer " },
      { type: "del", text: "Anlass" },
      { type: "add", text: "Termin" },
      { type: "same", text: " erstellt" },
    ]);
    expect(wordDiff("", "neu")).toEqual([{ type: "add", text: "neu" }]);
    expect(wordDiff("gleich", "gleich")).toEqual([{ type: "same", text: "gleich" }]);
  });
});

describe("module texts", () => {
  it("have the same keys and placeholders in all four languages", async () => {
    const { TRANSLATIONS_TEXTS } = await import("./texts");
    const de = TRANSLATIONS_TEXTS.de;
    for (const l of ["fr", "it", "en"] as const) {
      const other = TRANSLATIONS_TEXTS[l];
      expect(Object.keys(other).sort()).toEqual(Object.keys(de).sort());
      for (const k of Object.keys(de)) expect([k, placeholdersOf(other[k]!).sort()]).toEqual([k, placeholdersOf(de[k]!).sort()]);
    }
  });
});
