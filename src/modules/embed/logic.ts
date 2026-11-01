/**
 * Widgets für die Vereinswebsite: reine Hilfsfunktionen (Theme, Snippets, Parameter).
 * Ohne DB und ohne "server-only" – nutzbar in Routen, Admin-UI (Client) und Tests.
 */

export const WIDGET_KEYS = ["calendar", "ranking", "championship", "times"] as const;
export type WidgetKey = (typeof WIDGET_KEYS)[number];

export type WidgetMeta = {
  key: WidgetKey;
  label: string;
  description: string;
  /** Empfohlene Starthöhe des iframes in px (Auto-Resize passt sie an). */
  height: number;
  /** Benötigtes Modul (Hinweis im Admin) */
  module: "events" | "scores" | "championship" | "range";
  /** Muss signiert werden (Namen sichtbar) */
  signed: boolean;
};

export const WIDGETS: Record<WidgetKey, WidgetMeta> = {
  calendar: { key: "calendar", label: "Kalender", description: "Kommende Anlässe mit Datum, Zeit und Ort. Optional nach Art gefiltert.", height: 520, module: "events", signed: false },
  ranking: { key: "ranking", label: "Rangliste", description: "Bestes Resultat pro Mitglied in einem Programm, Namen gekürzt («Vorname N.»).", height: 560, module: "scores", signed: true },
  championship: { key: "championship", label: "Jahresmeisterschaft", description: "Rangliste einer veröffentlichten Meisterschaft.", height: 600, module: "championship", signed: true },
  times: { key: "times", label: "Schiesszeiten", description: "Bewilligte Schiesszeiten der Anlage pro Wochentag – praktisch für Anwohnende.", height: 420, module: "range", signed: false },
};

export function isWidgetKey(v: string | null | undefined): v is WidgetKey {
  return !!v && (WIDGET_KEYS as readonly string[]).includes(v);
}

export type EmbedTheme = "auto" | "light" | "dark";

export function parseTheme(v: string | null | undefined): EmbedTheme {
  return v === "light" || v === "dark" ? v : "auto";
}

const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;

export function isPlausibleEmbedToken(t: string | null | undefined): t is string {
  return !!t && TOKEN_RE.test(t);
}

/** Ganze Zahl in [min, max], sonst Standard. */
export function parseLimit(v: string | null | undefined, def: number, min: number, max: number) {
  const n = Number(v);
  if (!v || !Number.isInteger(n)) return def;
  return Math.min(max, Math.max(min, n));
}

/** Pfad eines Widgets mit Parametern (leere Werte werden weggelassen, feste Reihenfolge). */
export function widgetPath(token: string, widget: WidgetKey, params: Record<string, string | null | undefined> = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const qs = q.toString();
  return `/embed/${encodeURIComponent(token)}/${widget}${qs ? `?${qs}` : ""}`;
}

function attr(v: string) {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** HTML-Code für die Vereinswebsite: iframe mit empfohlener Höhe, ohne Rahmen, lazy geladen. */
export function iframeSnippet(opts: { src: string; title: string; height: number }) {
  return `<iframe src="${attr(opts.src)}" title="${attr(opts.title)}" data-standchef-embed width="100%" height="${Math.round(opts.height)}" style="width:100%;max-width:100%;border:0;overflow:hidden" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
}

/** Nachrichtentyp für die Höhe (Widget → Website). */
export const RESIZE_MESSAGE = "standchef-embed:height";

/**
 * Kleines Skript für die Website (einmal pro Seite): passt die Höhe aller Standchef-iframes an,
 * sobald das Widget seine Höhe per postMessage meldet. Akzeptiert nur Nachrichten von appOrigin.
 */
export function resizeScriptSnippet(appOrigin: string) {
  const origin = JSON.stringify(appOrigin.replace(/\/+$/, "")).replace(/</g, "\\u003c");
  return `<script>(function(){var o=${origin};window.addEventListener("message",function(e){if(e.origin!==o||!e.data||e.data.type!=="${RESIZE_MESSAGE}")return;var f=document.querySelectorAll("iframe[data-standchef-embed]");for(var i=0;i<f.length;i++){if(f[i].contentWindow===e.source){var h=Math.min(Math.max(Number(e.data.height)||0,120),5000);f[i].style.height=h+"px";}}});})();</script>`;
}

/** Skript im Widget: meldet die Höhe an die einbettende Seite (nur Zahl, keine Daten). */
export const CHILD_RESIZE_SCRIPT = `(function(){if(window.parent===window)return;var last=0;function send(){var h=Math.ceil(document.documentElement.getBoundingClientRect().height);if(h!==last){last=h;window.parent.postMessage({type:"${RESIZE_MESSAGE}",height:h},"*");}}if(window.ResizeObserver){new ResizeObserver(send).observe(document.documentElement);}window.addEventListener("load",send);send();})();`;

/**
 * Erlaubte frame-ancestors aus EMBED_FRAME_ANCESTORS (Leerzeichen- oder Komma-getrennt, ein
 * abschliessender «/» wird entfernt). Unzulässige Einträge werden verworfen (Schutz gegen
 * Header-Injection) und an onInvalid gemeldet. Nur ohne Wert gilt «*»; ist ein Wert gesetzt, aber
 * kein Eintrag gültig, gilt «'self'» (fail closed). Die eigene Origin ('self') ist immer erlaubt
 * (Live-Vorschau unter /admin/embed), ausser bei «'none'».
 */
export function frameAncestors(raw: string | null | undefined, onInvalid?: (entries: string[]) => void) {
  const entries = (raw ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((s) => (/^https?:\/\//i.test(s) ? s.replace(/\/+$/, "") : s));
  if (!entries.length) return "*";
  const valid = (s: string) =>
    /^(\*|'self'|'none'|https?:\/\/(\*\.)?[a-z0-9.-]+(:\d{1,5})?|(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{1,5})?)$/i.test(s);
  const ok = entries.filter(valid);
  const bad = entries.filter((s) => !valid(s));
  if (bad.length) onInvalid?.(bad);
  if (ok.includes("'none'")) return "'none'";
  if (ok.includes("*")) return "*";
  return ["'self'", ...ok.filter((s) => s !== "'self'")].join(" ");
}
