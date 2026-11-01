import { describe, expect, it } from "vitest";
import { frameAncestors, iframeSnippet, isPlausibleEmbedToken, parseLimit, parseTheme, resizeScriptSnippet, widgetPath } from "./logic";
import { escapeHtml, renderCalendarBody, renderRankingBody, renderShell, safeHref, themeCss } from "./render";
import { signEmbed, verifyEmbed } from "./signing";

const TOKEN = "a".repeat(43);
const SECRET = "test-secret-0123456789abcdef";

describe("embed logic", () => {
  it("parst Theme, Limit und Token", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("x")).toBe("auto");
    expect(parseLimit("50", 8, 1, 30)).toBe(30);
    expect(parseLimit("abc", 8, 1, 30)).toBe(8);
    expect(isPlausibleEmbedToken(TOKEN)).toBe(true);
    expect(isPlausibleEmbedToken("../x")).toBe(false);
  });

  it("baut Pfade und Snippets mit Escaping", () => {
    expect(widgetPath(TOKEN, "calendar", { kind: "TRAINING", theme: null })).toBe(`/embed/${TOKEN}/calendar?kind=TRAINING`);
    const s = iframeSnippet({ src: 'https://x.ch/embed/a?b=1&c="2"', title: "A <B>", height: 500 });
    expect(s).toContain('src="https://x.ch/embed/a?b=1&amp;c=&quot;2&quot;"');
    expect(s).toContain('title="A &lt;B&gt;"');
    expect(s).toContain('height="500"');
    const script = resizeScriptSnippet("https://app.standchef.ch/");
    expect(script).toContain('"https://app.standchef.ch"');
    expect(script).not.toContain("</script><");
  });

  it("frame-ancestors aus der Umgebung, unzulässige Werte verworfen", () => {
    expect(frameAncestors(undefined)).toBe("*");
    expect(frameAncestors("")).toBe("*");
    expect(frameAncestors("https://www.sv-muster.ch https://*.muster.ch")).toBe("'self' https://www.sv-muster.ch https://*.muster.ch");
    expect(frameAncestors("https://www.sv-muster.ch/,https://muster.ch")).toBe("'self' https://www.sv-muster.ch https://muster.ch");
    expect(frameAncestors("'none' https://a.ch")).toBe("'none'");
    const bad: string[][] = [];
    expect(frameAncestors("https://www.sv-müster.ch", (b) => bad.push(b))).toBe("'self'");
    expect(bad).toEqual([["https://www.sv-müster.ch"]]);
    expect(frameAncestors("https://a.ch; script-src *")).toBe("*");
    expect(frameAncestors("'self' evil\r\nX: y")).toBe("'self'");
  });

  it("signiert nur die erlaubten Parameter und prüft konstant", () => {
    const sig = signEmbed(TOKEN, "ranking", { program: "p1", period: "year" }, SECRET)!;
    expect(sig).toHaveLength(32);
    expect(verifyEmbed(TOKEN, "ranking", { program: "p1", period: "year" }, sig, SECRET)).toBe(true);
    expect(verifyEmbed(TOKEN, "ranking", { program: "p2", period: "year" }, sig, SECRET)).toBe(false);
    expect(verifyEmbed(TOKEN, "ranking", { program: "p1", period: "all" }, sig, SECRET)).toBe(false);
    expect(verifyEmbed("b".repeat(43), "ranking", { program: "p1", period: "year" }, sig, SECRET)).toBe(false);
    expect(verifyEmbed(TOKEN, "championship", { id: "p1" }, sig, SECRET)).toBe(false);
    expect(verifyEmbed(TOKEN, "ranking", { program: "p1", period: "year" }, null, SECRET)).toBe(false);
    expect(signEmbed(TOKEN, "championship", { id: "c" }, "short")).toBeNull();
  });
});

describe("embed render", () => {
  it("escapt HTML und Links", () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
    expect(safeHref("javascript:alert(1)")).toBe("");
    expect(safeHref("https://x.ch/?a=1&b=2")).toBe("https://x.ch/?a=1&amp;b=2");
  });

  it("Theme-CSS: hell, dunkel, automatisch mit Vereinsfarbe", () => {
    expect(themeCss("light", "#1d64c8")).not.toContain("prefers-color-scheme");
    expect(themeCss("dark", null)).toContain("color-scheme:dark");
    expect(themeCss("auto", "#1d64c8")).toContain("@media (prefers-color-scheme: dark)");
  });

  it("Kalender und Rangliste ohne Script-Injection", () => {
    const html = renderCalendarBody(
      [{ day: "5", month: "Jul", weekday: "Sa", dateLabel: "05.07.2026", timeLabel: "09:00 Uhr", title: "<script>x</script>", kindLabel: "Training", location: "Stand «Au»", cancelled: true }],
      { icalUrl: "https://x.ch/api/ical/tenant/t.ics", emptyText: "leer" },
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("Abgesagt");
    expect(html).toContain("In Kalender übernehmen");
    expect(renderRankingBody([], { emptyText: "Noch nichts" })).toContain("Noch nichts");
    const page = renderShell({ title: "T", clubName: "SV </title>", theme: "auto", brandColor: null, body: "", appUrl: "https://x.ch" });
    expect(page).toContain("noindex");
    expect(page).not.toContain("SV </title>");
    expect(page).toContain("postMessage");
  });
});
