/**
 * HTML der Widgets – reine String-Templates ohne React, ohne Cookies, ohne App-Bundle.
 * Alles wird escapt (escapeHtml). Farben: Standard-Tokens hell/dunkel plus Vereinsfarbe.
 */
import { brandColors, DEFAULT_ACCENT } from "@/lib/brand";
import { CHILD_RESIZE_SCRIPT, type EmbedTheme } from "./logic";

export function escapeHtml(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Nur http(s)-Links (sonst leer). */
export function safeHref(url: string | null | undefined) {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : "";
}

type Tokens = { bg: string; surface: string; surface2: string; ink: string; ink2: string; ink3: string; line: string; accent: string; accentInk: string; accentSoft: string; accentText: string; danger: string };

const LIGHT: Tokens = { bg: "#ffffff", surface: "#ffffff", surface2: "#f4f2ee", ink: "#151515", ink2: "#4a4a48", ink3: "#6b6965", line: "#e1ddd5", accent: "#d6232d", accentInk: "#ffffff", accentSoft: "#fbe4e5", accentText: "#c9212a", danger: "#c62828" };
const DARK: Tokens = { bg: "#111110", surface: "#1b1b1a", surface2: "#262625", ink: "#f3f1ec", ink2: "#c4c1ba", ink3: "#8f8c85", line: "#2e2d2b", accent: "#ef3b45", accentInk: "#ffffff", accentSoft: "#3a1b1d", accentText: "#f25c65", danger: "#ef5350" };

function withBrand(base: Tokens, mode: "light" | "dark", brandColor: string | null | undefined): Tokens {
  const v = brandColors(brandColor ?? DEFAULT_ACCENT);
  if (!v) return base;
  const m = v[mode];
  return { ...base, accent: m.accent, accentInk: m.accentInk, accentSoft: m.accentSoft, accentText: m.accentText };
}

function decls(t: Tokens, scheme: "light" | "dark") {
  return `--bg:${t.bg};--surface:${t.surface};--surface-2:${t.surface2};--ink:${t.ink};--ink-2:${t.ink2};--ink-3:${t.ink3};--line:${t.line};--accent:${t.accent};--accent-ink:${t.accentInk};--accent-soft:${t.accentSoft};--accent-text:${t.accentText};--danger:${t.danger};color-scheme:${scheme};`;
}

/** CSS-Variablen für das gewählte Theme («auto» folgt dem System der Besucher). */
export function themeCss(theme: EmbedTheme, brandColor: string | null | undefined) {
  const light = decls(withBrand(LIGHT, "light", brandColor), "light");
  const dark = decls(withBrand(DARK, "dark", brandColor), "dark");
  if (theme === "light") return `:root{${light}}`;
  if (theme === "dark") return `:root{${dark}}`;
  return `:root{${light}}@media (prefers-color-scheme: dark){:root{${dark}}}`;
}

const BASE_CSS = `*{box-sizing:border-box}html,body{margin:0;padding:0}body{background:var(--bg);color:var(--ink);font:15px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.w{padding:12px 16px 10px;max-width:960px;margin:0 auto}
.hd{display:flex;align-items:center;gap:10px;margin:0 0 10px}.hd img{width:32px;height:32px;border-radius:8px;object-fit:contain}
.hd h1{font-size:17px;line-height:1.25;margin:0;font-weight:650}.hd p{margin:0;font-size:13px;color:var(--ink-3)}
.list{list-style:none;margin:0;padding:0;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--surface)}
.list li{display:flex;gap:12px;align-items:flex-start;padding:10px 12px;border-top:1px solid var(--line);min-height:44px}.list li:first-child{border-top:0}
.date{flex:0 0 48px;text-align:center;border-radius:10px;background:var(--accent-soft);color:var(--accent-text);padding:4px 0;line-height:1.1}
.date b{display:block;font-size:18px}.date span{font-size:11px;text-transform:uppercase;letter-spacing:.03em}
.main{min-width:0;flex:1}.t{font-weight:600;overflow-wrap:anywhere}.m{font-size:13px;color:var(--ink-3);overflow-wrap:anywhere}
.chip{display:inline-block;font-size:11px;font-weight:600;padding:1px 8px;border-radius:999px;background:var(--surface-2);color:var(--ink-2);margin-right:6px;vertical-align:1px}
.cx .t{text-decoration:line-through;color:var(--ink-3)}.cx .chip{background:transparent;color:var(--danger);border:1px solid var(--danger)}
.rk{flex:0 0 32px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;background:var(--surface-2);color:var(--ink-2)}
.rk.p1{background:var(--accent);color:var(--accent-ink)}.sc{margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;align-self:center}
.list li.row{align-items:center}
.grid{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:10px 12px}
.grid .d{font-weight:600}.grid .r{font-variant-numeric:tabular-nums;color:var(--ink-2)}.grid .r.no{color:var(--ink-3)}
h2{font-size:14px;margin:14px 0 6px;color:var(--ink-2);font-weight:650}
.empty{border:1px dashed var(--line);border-radius:14px;padding:18px 14px;text-align:center;color:var(--ink-3);background:var(--surface)}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:12px;background:var(--accent);color:var(--accent-ink);text-decoration:none;font-weight:600;font-size:14px;margin-top:10px}
.btn:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ft{margin-top:10px;font-size:11px;color:var(--ink-3);display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.ft a{color:inherit}
.note{font-size:12px;color:var(--ink-3);margin-top:8px}`;

export type ShellInput = {
  title: string;
  clubName: string;
  subtitle?: string | null;
  logoUrl?: string | null;
  theme: EmbedTheme;
  brandColor: string | null | undefined;
  /** Bereits escaptes HTML */
  body: string;
  footerNote?: string | null;
  appUrl: string;
};

/** Vollständiges HTML-Dokument eines Widgets. */
export function renderShell(s: ShellInput) {
  const logo = s.logoUrl ? `<img src="${escapeHtml(s.logoUrl)}" alt="" width="32" height="32">` : "";
  const sub = s.subtitle ? `<p>${escapeHtml(s.subtitle)}</p>` : "";
  return `<!doctype html>
<html lang="de-CH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<title>${escapeHtml(`${s.title} · ${s.clubName}`)}</title>
<style>${themeCss(s.theme, s.brandColor)}
${BASE_CSS}</style></head>
<body><div class="w"><header class="hd">${logo}<div><h1>${escapeHtml(s.title)}</h1>${sub}</div></header>
${s.body}
<div class="ft"><span>${escapeHtml(s.footerNote ?? s.clubName)}</span><a href="${safeHref(s.appUrl)}" target="_blank" rel="noopener noreferrer">Standchef</a></div></div>
<script>${CHILD_RESIZE_SCRIPT}</script></body></html>`;
}

export function renderEmpty(text: string) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

/** Seite für ungültige Links/ausgeschaltete Widgets (ohne Vereinsdaten). */
export function renderMessagePage(title: string, text: string, theme: EmbedTheme, appUrl: string) {
  return renderShell({ title, clubName: "Standchef", theme, brandColor: null, body: renderEmpty(text), appUrl, footerNote: " " });
}

// ---------------------------------------------------------------------------
// Inhalte
// ---------------------------------------------------------------------------

export type CalendarItem = { day: string; month: string; weekday: string; dateLabel: string; timeLabel: string; title: string; kindLabel: string; location: string | null; cancelled: boolean };

export function renderCalendarBody(items: CalendarItem[], opts: { icalUrl: string | null; emptyText: string }) {
  const list = items.length
    ? `<ul class="list">${items
        .map(
          (e) => `<li class="${e.cancelled ? "cx" : ""}"><div class="date" aria-hidden="true"><b>${escapeHtml(e.day)}</b><span>${escapeHtml(e.month)}</span></div><div class="main"><div class="t">${escapeHtml(e.title)}</div><div class="m"><span class="chip">${escapeHtml(e.cancelled ? "Abgesagt" : e.kindLabel)}</span>${escapeHtml(`${e.weekday} ${e.dateLabel}${e.timeLabel ? ` · ${e.timeLabel}` : ""}`)}${e.location ? ` · ${escapeHtml(e.location)}` : ""}</div></div></li>`,
        )
        .join("")}</ul>`
    : renderEmpty(opts.emptyText);
  const ical = opts.icalUrl ? `<a class="btn" href="${safeHref(opts.icalUrl)}" target="_blank" rel="noopener noreferrer">In Kalender übernehmen</a>` : "";
  return list + ical;
}

export type RankRow = { rank: number; name: string; score: string; detail?: string | null };

export function renderRankingBody(rows: RankRow[], opts: { emptyText: string; note?: string | null; heading?: string | null }) {
  const head = opts.heading ? `<h2>${escapeHtml(opts.heading)}</h2>` : "";
  const list = rows.length
    ? `<ol class="list">${rows
        .map((r) => `<li class="row"><span class="rk${r.rank === 1 ? " p1" : ""}">${escapeHtml(r.rank)}</span><div class="main"><div class="t">${escapeHtml(r.name)}</div>${r.detail ? `<div class="m">${escapeHtml(r.detail)}</div>` : ""}</div><span class="sc">${escapeHtml(r.score)}</span></li>`)
        .join("")}</ol>`
    : renderEmpty(opts.emptyText);
  return head + list + (opts.note ? `<p class="note">${escapeHtml(opts.note)}</p>` : "");
}

export type TimesGroup = { name: string; days: Array<{ label: string; ranges: string | null }> };

export function renderTimesBody(groups: TimesGroup[], opts: { emptyText: string; note?: string | null }) {
  if (!groups.length) return renderEmpty(opts.emptyText);
  const html = groups
    .map((g) => `${groups.length > 1 || g.name ? `<h2>${escapeHtml(g.name)}</h2>` : ""}<div class="grid">${g.days.map((d) => `<span class="d">${escapeHtml(d.label)}</span><span class="r${d.ranges ? "" : " no"}">${escapeHtml(d.ranges ?? "kein Schiessbetrieb")}</span>`).join("")}</div>`)
    .join("");
  return html + (opts.note ? `<p class="note">${escapeHtml(opts.note)}</p>` : "");
}
