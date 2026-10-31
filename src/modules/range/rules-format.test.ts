import { describe, expect, it } from "vitest";
import { parseInline, parseRules, rulesExcerpt } from "./rules-format";

describe("Standordnung Markdown light", () => {
  it("fett", () => {
    expect(parseInline("Nur **mit Gehörschutz** schiessen")).toEqual([
      { text: "Nur ", bold: false },
      { text: "mit Gehörschutz", bold: true },
      { text: " schiessen", bold: false },
    ]);
    expect(parseInline("a ** b")).toEqual([{ text: "a ** b", bold: false }]);
  });
  it("Blöcke", () => {
    const blocks = parseRules("# Standordnung\n\nEinleitung\nzweite Zeile\n\n## Sicherheit\n- Eins\n- Zwei\n1. Erstens\n2) Zweitens\nSchluss");
    expect(blocks.map((b) => b.type)).toEqual(["h1", "p", "h2", "ul", "ol", "p"]);
    expect(blocks[1]).toEqual({ type: "p", parts: [{ text: "Einleitung zweite Zeile", bold: false }] });
    const ul = blocks[3]!;
    expect(ul.type === "ul" && ul.items.length).toBe(2);
  });
  it("kein HTML", () => {
    const blocks = parseRules("<script>alert(1)</script>");
    expect(blocks).toEqual([{ type: "p", parts: [{ text: "<script>alert(1)</script>", bold: false }] }]);
  });
  it("Auszug", () => {
    expect(rulesExcerpt("# Titel\n**fett** Text", 100)).toBe("Titel fett Text");
    expect(rulesExcerpt("x".repeat(20), 10)).toHaveLength(10);
  });
});
