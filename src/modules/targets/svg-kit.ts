import type { PaperSize, TargetParams } from "./types";

/**
 * Gemeinsame, reine Bausteine für die SVG-Generatoren (Masse in mm).
 * Kein DOM, kein Datum, kein Zufall – alles deterministisch.
 */

export type Box = { x: number; y: number; w: number; h: number };
export type Ctx = { box: Box; p: TargetParams; size: PaperSize };
export type Body = { body: string; note: string | null };

export function plain(body: string): Body {
  return { body, note: null };
}

/** Zahl kompakt mit max. 2 Nachkommastellen */
export function n(v: number) {
  return String(Math.round(v * 100) / 100);
}
export function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
export function int(v: number | undefined, def: number, lo: number, hi: number) {
  return clamp(Math.round(v ?? def), lo, hi);
}
export function circle(cx: number, cy: number, r: number, attrs: string) {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${attrs}/>`;
}
export function text(x: number, y: number, fs: number, s: string, attrs = 'fill="#000" text-anchor="middle" dominant-baseline="central"') {
  return `<text x="${n(x)}" y="${n(y)}" font-size="${n(fs)}" ${attrs}>${esc(s)}</text>`;
}
export function line(x1: number, y1: number, x2: number, y2: number, sw: number, color = "#000", extra = "") {
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" stroke-width="${n(sw)}"${extra ? " " + extra : ""}/>`;
}
export function rect(x: number, y: number, w: number, h: number, attrs: string) {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${attrs}/>`;
}

/** Massstab als Text, z.B. 1:12 oder 2:1 */
export function formatRatio(s: number) {
  if (Math.abs(s - 1) < 0.005) return "1:1";
  const fmt = (v: number) => {
    const d = v >= 10 ? 1 : 2;
    return String(Math.round(v * 10 ** d) / 10 ** d);
  };
  return s < 1 ? `1:${fmt(1 / s)}` : `${fmt(s)}:1`;
}

export function fmtM(v: number) {
  return String(Math.round(v * 10) / 10);
}

export function joinNote(...parts: Array<string | null | undefined>) {
  const x = parts.filter(Boolean);
  return x.length ? x.join(" · ") : null;
}

/** Deterministischer Zufall (mulberry32), damit Anordnungen reproduzierbar sind. */
export function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  const r = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
