import { describe, expect, it } from "vitest";
import { parseMarkdownLite, parseMdInline, sanitizeInternalHref } from "./markdown";

describe("sanitizeInternalHref", () => {
  it("accepts internal app paths", () => {
    expect(sanitizeInternalHref("/bookings")).toBe("/bookings");
    expect(sanitizeInternalHref("/admin/members?tab=open#x")).toBe("/admin/members?tab=open#x");
    expect(sanitizeInternalHref("/")).toBe("/");
  });

  it("rejects external, protocol-relative and script URLs", () => {
    for (const bad of [
      "https://evil.example", "http://x", "//evil.example/path", "javascript:alert(1)", "data:text/html,x",
      "mailto:a@b.ch", "/\\evil.example", "\\\\evil", "bookings", "/a b", "/x\"onmouseover=1", "/<script>",
    ]) {
      expect(sanitizeInternalHref(bad), bad).toBeNull();
    }
  });

  it("rejects path tricks and API routes", () => {
    expect(sanitizeInternalHref("/../etc")).toBeNull();
    expect(sanitizeInternalHref("/a/./b")).toBeNull();
    expect(sanitizeInternalHref("/api/export/me")).toBeNull();
    expect(sanitizeInternalHref("/api")).toBeNull();
    expect(sanitizeInternalHref("/%2f%2fevil.example")).toBeNull();
    expect(sanitizeInternalHref("/%5cevil")).toBeNull();
    expect(sanitizeInternalHref("/%2e%2e/api/ai/help")).toBeNull();
    expect(sanitizeInternalHref("/x/%2E%2E/%2e%2e/api/ai/help")).toBeNull();
    expect(sanitizeInternalHref("/%2e/bookings")).toBeNull();
    expect(sanitizeInternalHref("/" + "a".repeat(250))).toBeNull();
  });
});

describe("parseMdInline", () => {
  it("parses bold, code and internal links", () => {
    expect(parseMdInline("Tippe **Buchen** und dann [Reservationen](/bookings) mit `7KQ2PX`.")).toEqual([
      { kind: "text", text: "Tippe " },
      { kind: "strong", text: "Buchen" },
      { kind: "text", text: " und dann " },
      { kind: "link", text: "Reservationen", href: "/bookings" },
      { kind: "text", text: " mit " },
      { kind: "code", text: "7KQ2PX" },
      { kind: "text", text: "." },
    ]);
  });

  it("turns unsafe links into plain text (label only)", () => {
    expect(parseMdInline("Siehe [hier](https://evil.example) oder [das](javascript:alert`1`)")).toEqual([
      { kind: "text", text: "Siehe hier oder das" },
    ]);
  });

  it("links bare internal paths, but not API paths", () => {
    expect(parseMdInline("Unter /bookings findest du es.")).toEqual([
      { kind: "text", text: "Unter " },
      { kind: "link", text: "/bookings", href: "/bookings" },
      { kind: "text", text: " findest du es." },
    ]);
    expect(parseMdInline("(siehe /api/export/me)")).toEqual([{ kind: "text", text: "(siehe /api/export/me)" }]);
  });

  it("never produces HTML", () => {
    const parts = parseMdInline("<img src=x onerror=alert(1)> **<b>x</b>**");
    expect(parts.every((p) => p.kind !== "link")).toBe(true);
    expect(parts.map((p) => p.text).join("")).toBe("<img src=x onerror=alert(1)> <b>x</b>");
  });
});

describe("parseMarkdownLite", () => {
  it("builds paragraphs, headings and lists", () => {
    const blocks = parseMarkdownLite("# Titel\nZeile 1\nZeile 2\n\n- eins\n- zwei\n  weiter\n\n1. a\n2. b\n\n---\nEnde");
    expect(blocks.map((b) => b.kind)).toEqual(["h", "p", "ul", "ol", "p"]);
    const p = blocks[1]!;
    expect(p.kind === "p" && p.lines.length).toBe(2);
    const ul = blocks[2]!;
    expect(ul.kind === "ul" && ul.items[1]!.map((x) => x.text).join("")).toBe("zwei weiter");
    const ol = blocks[3]!;
    expect(ol.kind === "ol" && ol.start).toBe(1);
  });

  it("handles CRLF and empty input", () => {
    expect(parseMarkdownLite("")).toEqual([]);
    expect(parseMarkdownLite("a\r\n\r\nb").length).toBe(2);
  });
});
