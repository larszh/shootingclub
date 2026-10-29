import { describe, expect, it } from "vitest";
import { cleanHeader, renderMail, retryDelayMs, safeUrl } from "./render";

describe("renderMail", () => {
  it("escapes all input", () => {
    const { html, text } = renderMail({ title: "<b>Hallo</b>", paragraphs: ["a & b", "x\ny"], tenantName: "SV \"Test\"", button: { label: "Öffnen", url: "https://standchef.ch/a?b=1&c=2" } });
    expect(html).not.toContain("<b>Hallo</b>");
    expect(html).toContain("&lt;b&gt;Hallo&lt;/b&gt;");
    expect(html).toContain("a &amp; b");
    expect(html).toContain("x<br>y");
    expect(html).toContain("SV &quot;Test&quot;");
    expect(html).toContain("https://standchef.ch/a?b=1&amp;c=2");
    expect(text).toContain("Öffnen: https://standchef.ch/a?b=1&c=2");
  });

  it("rejects javascript urls and bad colors", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    const { html } = renderMail({ title: "t", paragraphs: [], accent: "red;background:url(x)" });
    expect(html).toContain("#d6232d");
    expect(html).not.toContain("url(x)");
  });

  it("strips header injection", () => {
    expect(cleanHeader("Hallo\r\nBcc: evil@x.ch")).toBe("Hallo Bcc: evil@x.ch");
  });

  it("backoff doubles", () => {
    expect(retryDelayMs(1)).toBe(120_000);
    expect(retryDelayMs(3)).toBe(480_000);
  });
});
