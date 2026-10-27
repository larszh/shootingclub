import { PAPER_MM, parseTargetParams, type PaperSize, type TargetParams, type TargetSubject } from "./types";

/**
 * Erzeugt ein druckfertiges SVG (schwarz/weiss) in Millimetern.
 * Das SVG füllt das gewählte Papierformat (Hochformat); der Fusszeilentext
 * wird vom Druck-Layout gesetzt, nicht hier.
 *
 * Das Modul ist bewusst rein (kein DOM, kein Datum, kein Zufall), damit es auf
 * dem Server, im Browser und offline gleich rechnet.
 */
export function renderTargetSvg(subject: TargetSubject, size: PaperSize, params: TargetParams = {}): string {
  return renderTarget(subject, size, params).svg;
}

export type RenderedTarget = {
  svg: string;
  /** Hinweis oben links (Massstab, Simulation, Titel), null wenn keiner */
  note: string | null;
};

/** Wie renderTargetSvg, liefert zusätzlich den Massstab-/Hinweistext. */
export function renderTarget(subject: TargetSubject, size: PaperSize, params: TargetParams = {}): RenderedTarget {
  const { w, h } = PAPER_MM[size];
  const margin = 10; // Druckrand
  const inner = { x: margin, y: margin, w: w - 2 * margin, h: h - 2 * margin - 8 }; // 8 mm Platz für Fusszeile
  // Ungültige Werte (z.B. halb eingetippt im Formular) werden verworfen, nie gerendert.
  const r = renderBody(subject, { box: inner, p: parseTargetParams(params), size });
  const noteSvg = r.note ? noteText(r.note, margin, inner.w) : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif">
<rect width="${w}" height="${h}" fill="#fff"/>
${r.body}${noteSvg}
</svg>`;
  return { svg, note: r.note };
}

type Box = { x: number; y: number; w: number; h: number };
type Ctx = { box: Box; p: TargetParams; size: PaperSize };
type Body = { body: string; note: string | null };

function plain(body: string): Body {
  return { body, note: null };
}

function renderBody(subject: TargetSubject, c: Ctx): Body {
  const { box, p } = c;
  switch (subject) {
    case "RINGS_10":
      return rings(c, 10);
    case "RINGS_5":
      return rings(c, 5);
    case "DOTS":
      return plain(dots(box, p));
    case "GRID":
      return plain(grid(box, p));
    case "SILHOUETTE":
      return plain(silhouette(box));
    case "DIAMOND":
      return plain(diamonds(box, p));
    case "ISSF_PISTOL":
      return official(c, ISSF_PISTOL, 25, "Präzisionspistole 25/50 m · nachempfunden");
    case "AIR_PISTOL":
      return official(c, AIR_PISTOL, 10, "Luftpistole 10 m · nachempfunden");
    case "AIR_RIFLE":
      return official(c, AIR_RIFLE, 10, "Luftgewehr 10 m · nachempfunden");
    case "AIR_RIFLE_SHEET":
      return airRifleSheet(c);
    case "RAPID_FIRE":
      return rapidFire(c);
    case "SWISS_A":
      return c.p.variant === "5"
        ? official(c, SWISS_A5, 300, "A-Scheibe 5er (CH-Stil) · nachempfunden, Masse angenähert")
        : official(c, SWISS_A10, 300, "A-Scheibe 10er (CH-Stil) · nachempfunden, Masse angenähert");
    case "SWISS_P10":
      return official(c, SWISS_P10, 50, "P10 (CH-Stil) · nachempfunden, Masse angenähert");
    case "BLANK_RINGS":
      return blankRings(c);
    case "ZEROING":
      return zeroing(c);
    case "DOT_DRILL":
      return dotDrill(c);
    case "CALLOUT":
      return callout(c);
    case "DISTANCE_LADDER":
      return distanceLadder(c);
    case "PLATES":
      return plates(c);
    case "TIC_TAC_TOE":
      return ticTacToe(c);
    case "NUMBER_GRID":
      return numberGrid(c);
    case "CLOCK":
      return clock(c);
    case "HUMANOID":
      return humanoid(c);
    default:
      return plain("");
  }
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Zahl kompakt mit max. 2 Nachkommastellen */
function n(v: number) {
  return String(Math.round(v * 100) / 100);
}
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function int(v: number | undefined, def: number, lo: number, hi: number) {
  return clamp(Math.round(v ?? def), lo, hi);
}
function circle(cx: number, cy: number, r: number, attrs: string) {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${attrs}/>`;
}
function text(x: number, y: number, fs: number, s: string, attrs = 'fill="#000" text-anchor="middle" dominant-baseline="central"') {
  return `<text x="${n(x)}" y="${n(y)}" font-size="${n(fs)}" ${attrs}>${esc(s)}</text>`;
}
function line(x1: number, y1: number, x2: number, y2: number, sw: number, color = "#000", extra = "") {
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" stroke-width="${n(sw)}"${extra ? " " + extra : ""}/>`;
}
function rect(x: number, y: number, w: number, h: number, attrs: string) {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${attrs}/>`;
}

/** Hinweiszeile oben links im Druckrand (grau, klein). */
function noteText(note: string, margin: number, maxW: number) {
  const est = note.length * 0.52;
  const fs = clamp(maxW / est, 1.8, 2.6);
  // Zu lang für die Breite (z.B. A6): auf Randbreite zusammendrücken statt abschneiden
  const fit = est * fs > maxW ? ` textLength="${n(maxW)}" lengthAdjust="spacingAndGlyphs"` : "";
  return `\n<text x="${margin}" y="7" font-size="${n(fs)}" fill="#666"${fit}>${esc(note)}</text>`;
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

function fmtM(v: number) {
  return String(Math.round(v * 10) / 10);
}

/**
 * Bestimmt den Massstab: Distanzskalierung (Schussdistanz / Originaldistanz),
 * danach Begrenzung auf den verfügbaren Platz.
 * nominal = Grösse 1:1 in mm, avail = verfügbarer Platz in mm.
 */
function resolveScale(
  nominal: number,
  avail: number,
  p: TargetParams,
  nominalDistanceM: number | undefined,
  size: PaperSize,
  always: boolean,
): { s: number; note: string | null } {
  const orig = p.originalDistanceM ?? nominalDistanceM;
  const shot = p.shotDistanceM;
  const simulated = !!(orig && shot && Math.abs(orig - shot) > 1e-6);
  const want = simulated ? shot! / orig! : 1;
  const clamped = nominal * want > avail + 0.01;
  const s = clamped ? avail / nominal : want;
  if (!simulated && !clamped && !always) return { s, note: null };
  const parts = [`Massstab ${formatRatio(s)}`];
  if (simulated) parts.push(`simuliert ${fmtM(orig!)} m auf ${fmtM(shot!)} m`);
  if (clamped) parts.push(simulated ? `zu gross für ${size}, verkleinert (Soll ${formatRatio(want)})` : `verkleinert auf ${size}`);
  return { s, note: parts.join(" · ") };
}

function joinNote(...parts: Array<string | null | undefined>) {
  const x = parts.filter(Boolean);
  return x.length ? x.join(" · ") : null;
}

/** Deterministischer Zufall (mulberry32), damit Anordnungen reproduzierbar sind. */
function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  const r = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ringscheiben nach Spezifikation (Masse in mm, 1:1)
// ---------------------------------------------------------------------------

type RingSpec = {
  /** Ringe von aussen nach innen: Wert und Aussendurchmesser der Zone */
  rings: { v: number; d: number }[];
  /** Durchmesser des schwarzen Spiegels */
  blackD: number;
  /** Innenzehner (Linie) */
  innerD?: number;
  /** Zentraler Punkt (z.B. Luftgewehr-Zehner) */
  dotD?: number;
  /** Werte, deren Zone beschriftet wird */
  labels: number[];
};

function spec(values: number[], diameter: (v: number) => number, blackD: number, labels: number[], innerD?: number, dotD?: number): RingSpec {
  return {
    rings: values.map((v) => ({ v, d: diameter(v) })).sort((a, b) => b.d - a.d),
    blackD,
    innerD,
    dotD,
    labels,
  };
}
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** 25/50 m Präzision: 10er 50 mm, je +50 mm Durchmesser, 1er 500 mm, Spiegel 7–10 = 200 mm, Innenzehner 25 mm */
const ISSF_PISTOL = spec(range(1, 10), (v) => 50 + (10 - v) * 50, 200, range(1, 8), 25);
/** Luftpistole: 10er 11.5 mm, je +16 mm, aussen 155.5 mm, Spiegel 7–10 = 59.5 mm, Innenzehner 5 mm */
const AIR_PISTOL = spec(range(1, 10), (v) => 11.5 + (10 - v) * 16, 59.5, range(1, 8), 5);
/** Luftgewehr: 10er-Punkt 0.5 mm, 9er 5.5 mm, je +5 mm, aussen 45.5 mm, Spiegel 4–9 = 30.5 mm */
const AIR_RIFLE = spec(range(1, 9), (v) => 5.5 + (9 - v) * 5, 30.5, range(1, 8), undefined, 0.5);
/** A-Scheibe 10er (angenähert): Ringe je 100 mm, aussen 1000 mm, Spiegel 600 mm */
const SWISS_A10 = spec(range(1, 10), (v) => (11 - v) * 100, 600, range(1, 9), 50);
/** A-Scheibe 5er (angenähert): Ringe je 200 mm, aussen 1000 mm, Spiegel 600 mm */
const SWISS_A5 = spec(range(1, 5), (v) => (6 - v) * 200, 600, range(1, 4), 100);
/** P10 (angenähert): wie Präzision, Ringzahlen 1–9 */
const SWISS_P10 = spec(range(1, 10), (v) => 50 + (10 - v) * 50, 200, range(1, 9), 25);
/** Schnellfeuer-Marke (angenähert): 10er 100 mm, je +80 mm, 5er 500 mm, ganz schwarz */
const RAPID_MARK = spec(range(5, 10), (v) => 100 + (10 - v) * 80, 500, [], 50);

function drawRings(cx: number, cy: number, sp: RingSpec, s: number, numbers: boolean): string {
  const parts: string[] = [];
  const sw = s < 0.3 ? 0.2 : 0.25;
  const outer = sp.rings[0];
  parts.push(circle(cx, cy, (outer.d * s) / 2, `fill="#fff" stroke="#000" stroke-width="${sw}"`));
  if (sp.blackD > 0) parts.push(circle(cx, cy, (sp.blackD * s) / 2, `fill="#000"`));
  for (const ring of sp.rings.slice(1)) {
    if (Math.abs(ring.d - sp.blackD) < 1e-6) continue;
    const inBlack = ring.d < sp.blackD;
    parts.push(circle(cx, cy, (ring.d * s) / 2, `fill="none" stroke="${inBlack ? "#fff" : "#000"}" stroke-width="${sw}"`));
  }
  if (sp.innerD) {
    const inBlack = sp.innerD < sp.blackD;
    parts.push(circle(cx, cy, (sp.innerD * s) / 2, `fill="none" stroke="${inBlack ? "#fff" : "#000"}" stroke-width="${sw}"`));
  }
  if (sp.dotD) {
    const inBlack = sp.dotD < sp.blackD;
    parts.push(circle(cx, cy, Math.max(0.25, (sp.dotD * s) / 2), `fill="${inBlack ? "#fff" : "#000"}"`));
  }
  if (numbers) {
    sp.rings.forEach((ring, i) => {
      if (!sp.labels.includes(ring.v)) return;
      const innerD = sp.rings[i + 1]?.d ?? sp.dotD ?? 0;
      const width = ((ring.d - innerD) / 2) * s;
      const fs = Math.min(5, width * 0.6);
      if (fs < 1.2) return;
      const midD = (ring.d + innerD) / 2;
      const r = (midD * s) / 2;
      const fill = midD < sp.blackD ? "#fff" : "#000";
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        parts.push(text(cx + dx * r, cy + dy * r, fs, String(ring.v), `fill="${fill}" text-anchor="middle" dominant-baseline="central"`));
      }
    });
  }
  return parts.join("\n");
}

/** Einzelne, nachempfundene Scheibe mit Massstab. */
function official(c: Ctx, sp: RingSpec, nominalDistanceM: number, title: string): Body {
  const { box, p, size } = c;
  const avail = Math.min(box.w, box.h);
  const { s, note } = resolveScale(sp.rings[0].d, avail, p, nominalDistanceM, size, true);
  const body = drawRings(box.x + box.w / 2, box.y + box.h / 2, sp, s, p.numbers ?? true);
  return { body, note: joinNote(title, note) };
}

// ---------------------------------------------------------------------------
// Bestehende Sujets (unverändert, ausser optionaler Distanzskalierung)
// ---------------------------------------------------------------------------

function ringTarget(cx: number, cy: number, outerR: number, ringCount: number, blackFrom: number, numbers: boolean) {
  const parts: string[] = [];
  const step = outerR / ringCount;
  // Von aussen nach innen zeichnen, damit der schwarze Spiegel oben liegt.
  for (let i = ringCount; i >= 1; i--) {
    const r = step * i;
    const black = i <= ringCount - blackFrom + 1;
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="${black ? "#000" : "#fff"}" stroke="${black ? "#fff" : "#000"}" stroke-width="0.3"/>`,
    );
  }
  // Mouche (innerster Zehner)
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${(step * 0.5).toFixed(2)}" fill="none" stroke="#fff" stroke-width="0.3"/>`);
  if (numbers) {
    const fs = Math.max(2.2, Math.min(4.5, step * 0.45));
    for (let i = 1; i < ringCount; i++) {
      const r = step * (i + 0.5);
      // Die Zahl liegt im Ring i+1 (von innen gezählt), daher dessen Farbe prüfen.
      const black = i + 1 <= ringCount - blackFrom + 1;
      const fill = black ? "#fff" : "#000";
      const n = ringCount - i;
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        parts.push(
          `<text x="${(cx + dx * r).toFixed(2)}" y="${(cy + dy * r).toFixed(2)}" font-size="${fs}" fill="${fill}" text-anchor="middle" dominant-baseline="central">${n}</text>`,
        );
      }
    }
  }
  return parts.join("\n");
}

function rings(c: Ctx, ringCount: number): Body {
  const { box, p } = c;
  const maxD = Math.min(box.w, box.h);
  let d = Math.min(p.diameterMm ?? maxD, maxD);
  let note: string | null = null;
  if (p.originalDistanceM && p.shotDistanceM) {
    const r = resolveScale(p.diameterMm ?? maxD, maxD, p, undefined, c.size, false);
    d = (p.diameterMm ?? maxD) * r.s;
    note = r.note;
  }
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const blackFrom = p.blackFrom ?? (ringCount === 10 ? 7 : 9);
  return { body: ringTarget(cx, cy, d / 2, ringCount, blackFrom, p.numbers ?? true), note };
}

function dots(box: Box, p: TargetParams) {
  const cols = p.columns ?? 3;
  const rows = p.rows ?? 4;
  const cellW = box.w / cols;
  const cellH = box.h / rows;
  const d = Math.min(p.diameterMm ?? Math.min(cellW, cellH) * 0.85, Math.min(cellW, cellH) * 0.95);
  const parts: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = box.x + cellW * (c + 0.5);
      const cy = box.y + cellH * (r + 0.5);
      parts.push(ringTarget(cx, cy, d / 2, 5, 4, p.numbers ?? false));
    }
  }
  return parts.join("\n");
}

function grid(box: Box, p: TargetParams) {
  const g = p.gridMm ?? 10;
  const parts: string[] = [];
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  // Raster um die Mitte herum zentriert
  for (let x = cx; x <= box.x + box.w; x += g) parts.push(vline(x, box, x === cx ? 0.6 : 0.2));
  for (let x = cx - g; x >= box.x; x -= g) parts.push(vline(x, box, 0.2));
  for (let y = cy; y <= box.y + box.h; y += g) parts.push(hline(y, box, y === cy ? 0.6 : 0.2));
  for (let y = cy - g; y >= box.y; y -= g) parts.push(hline(y, box, 0.2));
  // Zentrum: kleiner Kreis + Ringe für Referenz
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${g * 0.5}" fill="#000"/>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${g * 2.5}" fill="none" stroke="#000" stroke-width="0.5"/>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${g * 5}" fill="none" stroke="#000" stroke-width="0.5"/>`);
  parts.push(
    `<text x="${box.x + 2}" y="${box.y + 4}" font-size="3" fill="#000">Raster ${g} mm</text>`,
  );
  return parts.join("\n");
}
function vline(x: number, b: Box, sw: number) {
  return `<line x1="${x.toFixed(2)}" y1="${b.y}" x2="${x.toFixed(2)}" y2="${b.y + b.h}" stroke="#000" stroke-width="${sw}"/>`;
}
function hline(y: number, b: Box, sw: number) {
  return `<line x1="${b.x}" y1="${y.toFixed(2)}" x2="${b.x + b.w}" y2="${y.toFixed(2)}" stroke="#000" stroke-width="${sw}"/>`;
}

function silhouette(box: Box) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rx = Math.min(box.w, box.h * 0.6) / 2;
  const ry = box.h / 2;
  return [
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" stroke="#000" stroke-width="0.8"/>`,
    `<text x="${cx}" y="${cy + ry * 0.85}" font-size="5" text-anchor="middle" fill="#000">D</text>`,
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.66}" ry="${ry * 0.7}" fill="#fff" stroke="#000" stroke-width="0.8"/>`,
    `<text x="${cx}" y="${cy + ry * 0.58}" font-size="5" text-anchor="middle" fill="#000">C</text>`,
    `<ellipse cx="${cx}" cy="${cy - ry * 0.05}" rx="${rx * 0.36}" ry="${ry * 0.38}" fill="#000"/>`,
    `<text x="${cx}" y="${cy + ry * 0.25}" font-size="5" text-anchor="middle" fill="#fff">A</text>`,
    `<circle cx="${cx}" cy="${cy - ry * 0.15}" r="${rx * 0.08}" fill="none" stroke="#fff" stroke-width="0.4"/>`,
  ].join("\n");
}

function diamonds(box: Box, p: TargetParams) {
  const cols = p.columns ?? 2;
  const rows = p.rows ?? 3;
  const cellW = box.w / cols;
  const cellH = box.h / rows;
  const d = Math.min(p.diameterMm ?? Math.min(cellW, cellH) * 0.85, Math.min(cellW, cellH) * 0.95);
  const parts: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = box.x + cellW * (c + 0.5);
      const cy = box.y + cellH * (r + 0.5);
      const half = d / 2;
      for (const [k, fill] of [
        [1, "#000"],
        [0.66, "#fff"],
        [0.33, "#000"],
      ] as const) {
        const hh = half * k;
        parts.push(
          `<polygon points="${cx},${cy - hh} ${cx + hh},${cy} ${cx},${cy + hh} ${cx - hh},${cy}" fill="${fill}" stroke="#000" stroke-width="0.3"/>`,
        );
      }
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${half * 0.08}" fill="#fff"/>`);
    }
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Neue Sujets
// ---------------------------------------------------------------------------

function diamondMark(cx: number, cy: number, half: number) {
  const poly = (hh: number, fill: string) =>
    `<polygon points="${n(cx)},${n(cy - hh)} ${n(cx + hh)},${n(cy)} ${n(cx)},${n(cy + hh)} ${n(cx - hh)},${n(cy)}" fill="${fill}"/>`;
  return [poly(half, "#000"), poly(half * 0.62, "#fff"), poly(half * 0.3, "#000"), circle(cx, cy, Math.max(0.3, half * 0.06), 'fill="#fff"')].join("\n");
}

/** Mehrere Luftgewehrscheiben in nummerierten Feldern, optional mit Probescheibe. */
function airRifleSheet(c: Ctx): Body {
  const { box, p, size } = c;
  const cols = int(p.columns, 2, 1, 6);
  const rows = int(p.rows, 5, 1, 8);
  const sighter = p.sighter ?? true;
  const gap = 1.5;
  const cellW = (box.w - gap * (cols - 1)) / cols;
  const cellH = (box.h - gap * (rows - 1)) / rows;
  const labelH = Math.min(6, cellH * 0.18);
  // Breite Felder: Nummer steht links neben der Scheibe, dann zählt die volle Höhe.
  const sideLabel = cellW >= cellH + 24;
  const avail = Math.min(cellW - 4, sideLabel ? cellH - 2 : cellH - labelH - 3);
  const { s, note } = resolveScale(AIR_RIFLE.rings[0].d, avail, p, 10, size, true);
  const parts: string[] = [];
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = box.x + col * (cellW + gap);
      const y = box.y + r * (cellH + gap);
      const isSighter = sighter && k === 0;
      const label = isSighter ? "PROBE" : String(sighter ? k : k + 1);
      parts.push(rect(x, y, cellW, cellH, 'fill="none" stroke="#000" stroke-width="0.3"'));
      const fs = clamp(labelH * 0.7, 2, 4);
      parts.push(text(x + 2, y + labelH / 2 + 1, fs, label, 'fill="#000" font-weight="bold" dominant-baseline="central"'));
      if (isSighter) {
        const t = Math.min(12, cellW * 0.2, cellH * 0.25);
        parts.push(`<polygon points="${n(x + cellW - t)},${n(y)} ${n(x + cellW)},${n(y)} ${n(x + cellW)},${n(y + t)}" fill="#000"/>`);
      }
      parts.push(drawRings(x + cellW / 2, sideLabel ? y + cellH / 2 : y + labelH + (cellH - labelH) / 2, AIR_RIFLE, s, p.numbers ?? false));
      k++;
    }
  }
  return { body: parts.join("\n"), note: joinNote("Luftgewehr 10 m · nachempfunden", note) };
}

/** Schnellfeuer/Duell: Reihen mit fünf Haltepunkten (Ringmarken oder Ovale). */
function rapidFire(c: Ctx): Body {
  const { box, p, size } = c;
  const count = int(p.count, 5, 1, 6);
  const rows = int(p.rows, 3, 1, 8);
  const showNum = p.numbers ?? true;
  const rowH = box.h / rows;
  const cellW = box.w / count;
  const labelH = 5;
  const numH = showNum ? 5 : 0;
  const parts: string[] = [];
  let note: string | null = null;
  const ovals = p.variant === "ovals";
  let s = 1;
  if (!ovals) {
    const avail = Math.min(cellW * 0.92, rowH - labelH - numH - 2);
    const r = resolveScale(RAPID_MARK.rings[0].d, avail, p, 25, size, true);
    s = r.s;
    note = joinNote("Schnellfeuer-Marken · nachempfunden", r.note);
  } else {
    note = "Duell-Ovale · je Serie von links nach rechts";
  }
  for (let r = 0; r < rows; r++) {
    const y0 = box.y + r * rowH;
    parts.push(text(box.x, y0 + labelH / 2, 3, `Serie ${r + 1}`, 'fill="#000" font-weight="bold" dominant-baseline="central"'));
    if (r > 0) parts.push(line(box.x, y0, box.x + box.w, y0, 0.2, "#999", 'stroke-dasharray="1 1"'));
    const cy = y0 + labelH + (rowH - labelH - numH) / 2;
    for (let i = 0; i < count; i++) {
      const cx = box.x + cellW * (i + 0.5);
      if (ovals) {
        const ry = Math.min((rowH - labelH - numH - 2) / 2, cellW * 0.6);
        const rx = Math.min(cellW * 0.42, ry * 0.66);
        parts.push(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="#fff" stroke="#000" stroke-width="0.6"/>`);
        parts.push(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx * 0.62)}" ry="${n(ry * 0.62)}" fill="none" stroke="#000" stroke-width="0.4"/>`);
        parts.push(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx * 0.3)}" ry="${n(ry * 0.3)}" fill="#000"/>`);
        parts.push(circle(cx, cy, Math.max(0.4, rx * 0.06), 'fill="#fff"'));
      } else {
        parts.push(drawRings(cx, cy, RAPID_MARK, s, false));
      }
      if (showNum) parts.push(text(cx, y0 + rowH - numH / 2, 3, String(i + 1)));
    }
  }
  return { body: parts.join("\n"), note };
}

/** Nur Wertungsringe, gleichmässig verteilt, ohne Spiegel. */
function blankRings(c: Ctx): Body {
  const { box, p, size } = c;
  const avail = Math.min(box.w, box.h);
  const count = int(p.ringCount, 10, 1, 10);
  const base = Math.min(p.diameterMm ?? avail, p.originalDistanceM && p.shotDistanceM ? 300 : avail);
  const { s, note } = resolveScale(base, avail, p, undefined, size, false);
  const d = base * s;
  const step = d / count;
  const values = range(11 - count, 10);
  const sp: RingSpec = {
    rings: values.map((v, i) => ({ v, d: d - i * step })),
    blackD: 0,
    labels: values.slice(0, -1),
  };
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const cross = Math.min(3, step * 0.4);
  const body = [
    drawRings(cx, cy, sp, 1, p.numbers ?? false),
    line(cx - cross, cy, cx + cross, cy, 0.25),
    line(cx, cy - cross, cx, cy + cross, 0.25),
  ].join("\n");
  return { body, note };
}

/** Einschiessen: cm-Raster, Rauten als Haltepunkte, Hilfetext MOA/mrad. */
function zeroing(c: Ctx): Body {
  const { box, p } = c;
  const g = clamp(p.gridMm ?? 10, 2, 50);
  const dist = clamp(p.shotDistanceM ?? 25, 1, 1000);
  const textH = Math.min(14, box.h * 0.12);
  const area: Box = { x: box.x, y: box.y, w: box.w, h: box.h - textH };
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;
  const parts: string[] = [];
  const nx = Math.floor(area.w / 2 / g);
  const ny = Math.floor(area.h / 2 / g);
  const gx0 = cx - nx * g;
  const gx1 = cx + nx * g;
  const gy0 = cy - ny * g;
  const gy1 = cy + ny * g;
  for (let i = -nx; i <= nx; i++) {
    const x = cx + i * g;
    const sw = i === 0 ? 0.7 : i % 5 === 0 ? 0.45 : 0.15;
    parts.push(line(x, gy0, x, gy1, sw));
  }
  for (let j = -ny; j <= ny; j++) {
    const y = cy + j * g;
    const sw = j === 0 ? 0.7 : j % 5 === 0 ? 0.45 : 0.15;
    parts.push(line(gx0, y, gx1, y, sw));
  }
  // Achsbeschriftung an den kräftigen Linien
  const unit = g === 10 ? "cm" : "mm";
  const lab = (k: number) => (g === 10 ? String(Math.abs(k)) : n(Math.abs(k) * g));
  for (let i = -nx; i <= nx; i++) {
    if (i === 0 || i % 5 !== 0) continue;
    parts.push(rect(cx + i * g - 2.5, gy0 + 0.6, 5, 3, 'fill="#fff"'));
    parts.push(text(cx + i * g, gy0 + 2.1, 2.2, lab(i), 'fill="#555" text-anchor="middle" dominant-baseline="central"'));
  }
  for (let j = -ny; j <= ny; j++) {
    if (j === 0 || j % 5 !== 0) continue;
    parts.push(rect(gx0 + 0.6, cy + j * g - 1.5, 5, 3, 'fill="#fff"'));
    parts.push(text(gx0 + 3.1, cy + j * g, 2.2, lab(j), 'fill="#555" text-anchor="middle" dominant-baseline="central"'));
  }
  // Rauten: Mitte gross, vier Ecken kleiner
  const big = Math.min(2.5 * g, area.w / 7, area.h / 7);
  parts.push(diamondMark(cx, cy, big));
  const ox = Math.max(1, Math.floor(nx * 0.6)) * g;
  const oy = Math.max(1, Math.floor(ny * 0.6)) * g;
  const small = Math.min(1.5 * g, big * 0.7, ox / 2.5, oy / 2.5);
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(diamondMark(cx + dx * ox, cy + dy * oy, small));
  // Hilfetext
  const moa = (29.0888 * dist) / 100;
  const lines = [
    `Raster ${n(g)} mm · Beschriftung in ${unit} ab Mitte · 1 Zoll = 25.4 mm`,
    `1 MOA ≈ 29.1 mm auf 100 m ≈ ${n(moa)} mm auf ${fmtM(dist)} m`,
    `1 mrad = ${fmtM(dist)} mm auf ${fmtM(dist)} m · Treffpunktlage messen, Visier korrigieren`,
  ];
  const longest = Math.max(...lines.map((l) => l.length));
  const fs = clamp(box.w / (longest * 0.5), 1.6, 2.8);
  lines.forEach((l, i) => parts.push(text(box.x, area.y + area.h + 3 + i * (fs * 1.35) + fs / 2, fs, l, 'fill="#444" dominant-baseline="central"')));
  return { body: parts.join("\n"), note: null };
}

const DRILL_TASKS: { kind: "circle" | "square"; size: number; task: string }[] = [
  { kind: "circle", size: 50, task: "5 Schuss langsam, ohne Zeitlimit" },
  { kind: "circle", size: 50, task: "5 × 1 Schuss aus der Bereitschaft" },
  { kind: "square", size: 50, task: "3 × Doublette (2 Schuss schnell)" },
  { kind: "circle", size: 25, task: "4 → 5: je 1 Schuss mit Zielwechsel, 3 ×" },
  { kind: "circle", size: 25, task: "zweites Ziel zu Nr. 4" },
  { kind: "square", size: 25, task: "5 Schuss nur schwache Hand" },
  { kind: "circle", size: 38, task: "5 Schuss nur starke Hand" },
  { kind: "square", size: 38, task: "Anschlag + 1 Schuss, 5 ×" },
  { kind: "circle", size: 25, task: "9 → 10: je 2 Schuss mit Zielwechsel" },
  { kind: "circle", size: 25, task: "zweites Ziel zu Nr. 9" },
];

/** Punkte-Drill 1–10 mit Aufgabenliste. */
function dotDrill(c: Ctx): Body {
  const { box, p } = c;
  const showTasks = p.numbers ?? true;
  const legendH = showTasks ? box.h * 0.3 : 0;
  const area: Box = { x: box.x, y: box.y, w: box.w, h: box.h - legendH };
  const cols = 3;
  const rows = 4;
  const cellW = area.w / cols;
  const cellH = area.h / rows;
  const k = Math.min(1, (Math.min(cellW, cellH - 4) * 0.82) / 50);
  const parts: string[] = [];
  DRILL_TASKS.forEach((t, i) => {
    const row = Math.floor(i / cols);
    const inRow = row === 3 ? 1 : cols;
    const col = row === 3 ? 0 : i % cols;
    const cx = area.x + (inRow === 1 ? area.w / 2 : cellW * (col + 0.5));
    const cy = area.y + cellH * (row + 0.5) + 2;
    const sz = t.size * k;
    if (t.kind === "circle") parts.push(circle(cx, cy, sz / 2, 'fill="#fff" stroke="#000" stroke-width="0.6"'));
    else parts.push(rect(cx - sz / 2, cy - sz / 2, sz, sz, 'fill="#fff" stroke="#000" stroke-width="0.6"'));
    parts.push(circle(cx, cy, Math.max(0.8, sz * 0.1), 'fill="#000"'));
    const fs = clamp(cellH * 0.12, 2.5, 5);
    parts.push(text(cx - sz / 2 - 1, cy - sz / 2 - 0.5, fs, String(i + 1), 'fill="#000" font-weight="bold" text-anchor="end" dominant-baseline="auto"'));
  });
  if (showTasks) {
    const twoCols = box.w >= 120;
    const perCol = twoCols ? 5 : 10;
    const colW = twoCols ? box.w / 2 : box.w;
    const y0 = area.y + area.h + 3;
    const lineH = (legendH - 3) / perCol;
    const longest = Math.max(...DRILL_TASKS.map((t) => t.task.length + 4));
    const fs = clamp(Math.min(lineH * 0.7, colW / (longest * 0.5)), 1.5, 3.2);
    parts.push(line(box.x, area.y + area.h + 0.5, box.x + box.w, area.y + area.h + 0.5, 0.2, "#999"));
    DRILL_TASKS.forEach((t, i) => {
      const colIdx = Math.floor(i / perCol);
      const x = box.x + colIdx * colW;
      const y = y0 + (i % perCol) * lineH + lineH / 2;
      parts.push(text(x, y, fs, String(i + 1), 'fill="#000" font-weight="bold" dominant-baseline="central"'));
      parts.push(text(x + fs * 1.4, y, fs, t.task, 'fill="#000" dominant-baseline="central"'));
    });
  }
  return { body: parts.join("\n"), note: "Punkte-Drill 1–10 · Aufgabe pro Nummer" };
}

type ShapeKind = "circle" | "square" | "triangle";
function shape(kind: ShapeKind, cx: number, cy: number, size: number, filled: boolean, sw: number) {
  const fill = filled ? "#000" : "#fff";
  if (kind === "circle") return circle(cx, cy, size / 2, `fill="${fill}" stroke="#000" stroke-width="${sw}"`);
  if (kind === "square") return rect(cx - size * 0.45, cy - size * 0.45, size * 0.9, size * 0.9, `fill="${fill}" stroke="#000" stroke-width="${sw}"`);
  // Gleichseitiges Dreieck, Schwerpunkt im Zentrum
  const h = (size * Math.sqrt(3)) / 2;
  const top = cy - (2 / 3) * h * 0.95;
  const bottom = cy + (1 / 3) * h * 0.95;
  const half = (size / 2) * 0.95;
  return `<polygon points="${n(cx)},${n(top)} ${n(cx + half)},${n(bottom)} ${n(cx - half)},${n(bottom)}" fill="${fill}" stroke="#000" stroke-width="${sw}" stroke-linejoin="round"/>`;
}

/** Ansage-Training: Formen mit Zahlen 1–9 und Buchstaben A–C. */
function callout(c: Ctx): Body {
  const { box, p } = c;
  const seed = int(p.seed, 1, 0, 9999);
  const labels = shuffle(["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C"], seed);
  const kinds = shuffle<ShapeKind>(["circle", "square", "triangle", "circle", "square", "triangle", "circle", "square", "triangle", "circle", "square", "triangle"], seed + 7);
  const cols = 3;
  const rows = 4;
  const cellW = box.w / cols;
  const cellH = box.h / rows;
  const size = Math.min(cellW, cellH) * 0.8;
  const sw = clamp(size * 0.025, 0.5, 1.2);
  const parts: string[] = [];
  labels.forEach((lab, i) => {
    const cx = box.x + cellW * ((i % cols) + 0.5);
    const cy = box.y + cellH * (Math.floor(i / cols) + 0.5);
    const kind = kinds[i];
    const filled = (i + seed) % 4 === 0;
    parts.push(shape(kind, cx, cy, size, filled, sw));
    const fs = size * (kind === "triangle" ? 0.28 : 0.4);
    const ty = kind === "triangle" ? cy + size * 0.04 : cy;
    parts.push(text(cx, ty, fs, lab, `fill="${filled ? "#fff" : "#000"}" font-weight="bold" text-anchor="middle" dominant-baseline="central"`));
  });
  return { body: parts.join("\n"), note: `Ansage-Training · z.B. «Dreieck 4» oder «Kreis B» · Anordnung ${seed}` };
}

/** Distanzleiter: gleiche Scheibe, Grösse = Schussdistanz / simulierte Distanz. */
function distanceLadder(c: Ctx): Body {
  const { box, p } = c;
  const shot = clamp(p.shotDistanceM ?? 10, 1, 1000);
  const step = clamp(p.stepM ?? 5, 1, 100);
  const count = int(p.count, 4, 2, 8);
  const cols = count <= 3 ? 1 : 2;
  const rows = Math.ceil(count / cols);
  const cellW = box.w / cols;
  const cellH = box.h / rows;
  const labelH = 5;
  const maxBase = Math.min(cellW, cellH - labelH - 2) * 0.92;
  const base = Math.min(p.diameterMm ?? maxBase, maxBase);
  const parts: string[] = [];
  const dists: number[] = [];
  for (let i = 0; i < count; i++) {
    const dist = shot + i * step;
    dists.push(dist);
    const ratio = shot / dist;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = box.x + cellW * (col + 0.5);
    const cy = box.y + cellH * row + (cellH - labelH) / 2;
    parts.push(ringTarget(Math.round(cx * 100) / 100, Math.round(cy * 100) / 100, (base * ratio) / 2, 5, 4, false));
    const label = i === 0 ? `${fmtM(dist)} m (Originalgrösse)` : `simuliert ${fmtM(dist)} m · ${formatRatio(ratio)}`;
    parts.push(text(cx, box.y + cellH * (row + 1) - labelH / 2 - 1, 2.8, label));
  }
  return { body: parts.join("\n"), note: `Aus ${fmtM(shot)} m schiessen · Grössen entsprechen ${dists.map(fmtM).join("/")} m` };
}

/** Plates-Rack oder Kegel in Reihen. */
function plates(c: Ctx): Body {
  const { box, p } = c;
  const count = int(p.count, 6, 1, 8);
  const rows = int(p.rows, 2, 1, 4);
  const pins = p.variant === "pins";
  const rowH = box.h / rows;
  const cellW = box.w / count;
  const parts: string[] = [];
  for (let r = 0; r < rows; r++) {
    const y0 = box.y + r * rowH;
    const ph = Math.min(rowH * 0.7, cellW * 1.8);
    const d = Math.min(cellW * 0.86, rowH * 0.55);
    const itemH = pins ? ph : d + 6;
    const barH = Math.min(3, rowH * 0.03 + 1);
    const numH = 7;
    const barY = y0 + (rowH - (itemH + barH + numH)) / 2 + itemH;
    if (r > 0) parts.push(line(box.x, y0, box.x + box.w, y0, 0.2, "#999", 'stroke-dasharray="1 1"'));
    parts.push(rect(box.x + 2, barY, box.w - 4, barH, 'fill="#000"'));
    for (let i = 0; i < count; i++) {
      const cx = box.x + cellW * (i + 0.5);
      if (pins) {
        parts.push(pinPath(cx, barY - ph, ph));
      } else {
        const cy = barY - 6 - d / 2;
        parts.push(line(cx, cy + d / 2, cx, barY, 1.2));
        parts.push(circle(cx, cy, d / 2, 'fill="#fff" stroke="#000" stroke-width="1"'));
        parts.push(circle(cx, cy, d * 0.2, 'fill="#000"'));
        parts.push(circle(cx, cy, Math.max(0.4, d * 0.03), 'fill="#fff"'));
      }
      parts.push(text(cx, barY + barH + numH / 2, clamp(cellW * 0.18, 2.5, 4), String(i + 1)));
    }
  }
  return { body: parts.join("\n"), note: pins ? "Kegel · Speed-Drill von links nach rechts" : "Plates-Rack · Speed-Drill von links nach rechts" };
}

function pinPath(cx: number, top: number, h: number) {
  // Profil (halbe Breite relativ zur Höhe)
  const X = (dx: number) => n(cx + dx * h);
  const Y = (dy: number) => n(top + dy * h);
  const right = `C ${X(0.08)} ${Y(0)} ${X(0.13)} ${Y(0.04)} ${X(0.13)} ${Y(0.1)} C ${X(0.13)} ${Y(0.17)} ${X(0.07)} ${Y(0.2)} ${X(0.07)} ${Y(0.28)} C ${X(0.07)} ${Y(0.38)} ${X(0.24)} ${Y(0.46)} ${X(0.24)} ${Y(0.64)} C ${X(0.24)} ${Y(0.8)} ${X(0.17)} ${Y(0.92)} ${X(0.13)} ${Y(1)}`;
  const left = `L ${X(-0.13)} ${Y(1)} C ${X(-0.17)} ${Y(0.92)} ${X(-0.24)} ${Y(0.8)} ${X(-0.24)} ${Y(0.64)} C ${X(-0.24)} ${Y(0.46)} ${X(-0.07)} ${Y(0.38)} ${X(-0.07)} ${Y(0.28)} C ${X(-0.07)} ${Y(0.2)} ${X(-0.13)} ${Y(0.17)} ${X(-0.13)} ${Y(0.1)} C ${X(-0.13)} ${Y(0.04)} ${X(-0.08)} ${Y(0)} ${X(0)} ${Y(0)}`;
  return [
    `<path d="M ${X(0)} ${Y(0)} ${right} ${left} Z" fill="#fff" stroke="#000" stroke-width="0.8" stroke-linejoin="round"/>`,
    rect(cx - 0.075 * h, top + 0.3 * h, 0.15 * h, 0.035 * h, 'fill="#000"'),
    circle(cx, top + 0.64 * h, h * 0.07, 'fill="#000"'),
    circle(cx, top + 0.64 * h, Math.max(0.3, h * 0.012), 'fill="#fff"'),
  ].join("\n");
}

/** Tic-Tac-Toe-Spielfeld(er) mit Haltepunkten. */
function ticTacToe(c: Ctx): Body {
  const { box, p } = c;
  const boards = int(p.count, 1, 1, 2);
  const areaH = box.h / boards;
  const parts: string[] = [];
  for (let b = 0; b < boards; b++) {
    const y0 = box.y + b * areaH;
    const titleH = 7;
    const B = Math.min(box.w, areaH - titleH - 2) * 0.96;
    const x0 = box.x + (box.w - B) / 2;
    const top = y0 + titleH + (areaH - titleH - B) / 2;
    parts.push(text(box.x + box.w / 2, top - titleH / 2, 4, boards > 1 ? `Spiel ${b + 1}` : "Tic-Tac-Toe", 'fill="#000" font-weight="bold" text-anchor="middle" dominant-baseline="central"'));
    const cell = B / 3;
    for (let i = 1; i < 3; i++) {
      parts.push(line(x0 + i * cell, top, x0 + i * cell, top + B, 1.4, "#000", 'stroke-linecap="round"'));
      parts.push(line(x0, top + i * cell, x0 + B, top + i * cell, 1.4, "#000", 'stroke-linecap="round"'));
    }
    for (let r = 0; r < 3; r++) {
      for (let col = 0; col < 3; col++) {
        const cx = x0 + cell * (col + 0.5);
        const cy = top + cell * (r + 0.5);
        parts.push(circle(cx, cy, cell * 0.3, 'fill="#fff" stroke="#000" stroke-width="0.5"'));
        parts.push(circle(cx, cy, cell * 0.17, 'fill="none" stroke="#000" stroke-width="0.4"'));
        parts.push(circle(cx, cy, cell * 0.07, 'fill="#000"'));
      }
    }
  }
  return { body: parts.join("\n"), note: "Tic-Tac-Toe · abwechselnd je 1 Schuss – drei in einer Reihe gewinnt" };
}

/** Zahlenfeld 1–25 gemischt oder Bingo-Karte. */
function numberGrid(c: Ctx): Body {
  const { box, p } = c;
  const seed = int(p.seed, 1, 0, 9999);
  const bingo = p.variant === "bingo";
  const headerH = bingo ? Math.min(12, box.h * 0.08) : 0;
  const B = Math.min(box.w, box.h - headerH);
  const x0 = box.x + (box.w - B) / 2;
  const y0 = box.y + headerH + (box.h - headerH - B) / 2;
  const cell = B / 5;
  let cells: string[];
  if (bingo) {
    const cols = [0, 1, 2, 3, 4].map((j) => shuffle(range(15 * j + 1, 15 * j + 15), seed + j * 31).slice(0, 5));
    cells = [];
    for (let r = 0; r < 5; r++) for (let j = 0; j < 5; j++) cells.push(r === 2 && j === 2 ? "FREI" : String(cols[j][r]));
  } else {
    cells = shuffle(range(1, 25), seed).map(String);
  }
  const parts: string[] = [];
  if (bingo) {
    "BINGO".split("").forEach((ch, j) => parts.push(text(x0 + cell * (j + 0.5), y0 - headerH / 2, headerH * 0.75, ch, 'fill="#000" font-weight="bold" text-anchor="middle" dominant-baseline="central"')));
  }
  parts.push(rect(x0, y0, B, B, 'fill="none" stroke="#000" stroke-width="0.8"'));
  for (let i = 1; i < 5; i++) {
    parts.push(line(x0 + i * cell, y0, x0 + i * cell, y0 + B, 0.4));
    parts.push(line(x0, y0 + i * cell, x0 + B, y0 + i * cell, 0.4));
  }
  cells.forEach((lab, i) => {
    const cx = x0 + cell * ((i % 5) + 0.5);
    const cy = y0 + cell * (Math.floor(i / 5) + 0.5);
    if (lab === "FREI") {
      parts.push(rect(cx - cell / 2 + 1, cy - cell / 2 + 1, cell - 2, cell - 2, 'fill="#000"'));
      parts.push(text(cx, cy, cell * 0.22, "FREI", 'fill="#fff" font-weight="bold" text-anchor="middle" dominant-baseline="central"'));
      return;
    }
    parts.push(circle(cx, cy, cell * 0.36, 'fill="#fff" stroke="#000" stroke-width="0.5"'));
    parts.push(text(cx, cy, cell * 0.3, lab, 'fill="#000" font-weight="bold" text-anchor="middle" dominant-baseline="central"'));
  });
  return { body: parts.join("\n"), note: bingo ? `Bingo · Zahl ansagen und treffen · Karte ${seed}` : `Zahlenfeld 1–25 · Zahl ansagen und treffen · Anordnung ${seed}` };
}

/** Uhr: zwölf Ziele an den Stundenpositionen. */
function clock(c: Ctx): Body {
  const { box, p } = c;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const R = (Math.min(box.w, box.h) / 2) * 0.97;
  const parts: string[] = [circle(cx, cy, R, 'fill="#fff" stroke="#000" stroke-width="0.8"')];
  for (let m = 0; m < 60; m++) {
    const a = (m / 60) * Math.PI * 2;
    const len = m % 5 === 0 ? R * 0.05 : R * 0.025;
    parts.push(line(cx + Math.sin(a) * (R - len), cy - Math.cos(a) * (R - len), cx + Math.sin(a) * R, cy - Math.cos(a) * R, m % 5 === 0 ? 0.6 : 0.25));
  }
  const rt = R * 0.12;
  for (let hIdx = 1; hIdx <= 12; hIdx++) {
    const a = (hIdx / 12) * Math.PI * 2;
    const tx = cx + Math.sin(a) * R * 0.76;
    const ty = cy - Math.cos(a) * R * 0.76;
    parts.push(circle(tx, ty, rt, 'fill="#fff" stroke="#000" stroke-width="0.6"'));
    parts.push(circle(tx, ty, rt * 0.55, 'fill="none" stroke="#000" stroke-width="0.4"'));
    parts.push(circle(tx, ty, rt * 0.22, 'fill="#000"'));
    if (p.numbers ?? true) {
      const lx = cx + Math.sin(a) * R * 0.52;
      const ly = cy - Math.cos(a) * R * 0.52;
      parts.push(text(lx, ly, R * 0.09, String(hIdx), 'fill="#000" font-weight="bold" text-anchor="middle" dominant-baseline="central"'));
    }
  }
  parts.push(circle(cx, cy, R * 0.14, 'fill="#000"'));
  parts.push(circle(cx, cy, R * 0.08, 'fill="none" stroke="#fff" stroke-width="0.4"'));
  parts.push(circle(cx, cy, R * 0.02, 'fill="#fff"'));
  return { body: parts.join("\n"), note: "Uhr · Ansage «3 Uhr» – Ziel 3 treffen · Mitte = Startpunkt" };
}

/** Neutrale Umriss-Silhouette (kein Gesicht) mit Trefferzonen. */
function humanoid(c: Ctx): Body {
  const { box, p } = c;
  const variant = p.variant === "headchest" || p.variant === "noshoot" ? p.variant : "zones";
  // Einheitskoordinaten: Breite 1, Höhe 1.5
  const k = Math.min(box.w / 1, box.h / 1.5) * 0.97;
  const ox = box.x + (box.w - k) / 2;
  const oy = box.y + (box.h - 1.5 * k) / 2;
  const X = (x: number) => n(ox + x * k);
  const Y = (y: number) => n(oy + y * k);
  const P = (x: number, y: number) => `${X(x)} ${Y(y)}`;
  const parts: string[] = [];
  const torso = `M ${P(0.44, 0.255)} L ${P(0.44, 0.29)} C ${P(0.25, 0.3)} ${P(0.08, 0.32)} ${P(0.05, 0.42)} L ${P(0.02, 1.5)} L ${P(0.98, 1.5)} L ${P(0.95, 0.42)} C ${P(0.92, 0.32)} ${P(0.75, 0.3)} ${P(0.56, 0.29)} L ${P(0.56, 0.255)} Z`;
  parts.push(`<path d="${torso}" fill="#fff" stroke="#000" stroke-width="0.8" stroke-linejoin="round"/>`);
  parts.push(`<ellipse cx="${X(0.5)}" cy="${Y(0.14)}" rx="${n(0.115 * k)}" ry="${n(0.135 * k)}" fill="#fff" stroke="#000" stroke-width="0.8"/>`);
  const zr = (x: number, y: number, w: number, h: number, sw = 0.45) => rect(ox + x * k, oy + y * k, w * k, h * k, `fill="none" stroke="#000" stroke-width="${sw}" rx="${n(0.02 * k)}"`);
  const lbl = (x: number, y: number, s: string, size = 0.055) => text(ox + x * k, oy + y * k, size * k, s, 'fill="#000" font-weight="bold" text-anchor="middle" dominant-baseline="central"');
  let note = "Silhouette · Zonen A/C/D";
  if (variant === "headchest") {
    parts.push(`<ellipse cx="${X(0.5)}" cy="${Y(0.14)}" rx="${n(0.07 * k)}" ry="${n(0.08 * k)}" fill="none" stroke="#000" stroke-width="0.6"/>`);
    parts.push(circle(ox + 0.5 * k, oy + 0.14 * k, Math.max(0.6, 0.012 * k), 'fill="#000"'));
    parts.push(circle(ox + 0.5 * k, oy + 0.6 * k, 0.17 * k, 'fill="none" stroke="#000" stroke-width="0.6"'));
    parts.push(circle(ox + 0.5 * k, oy + 0.6 * k, Math.max(0.8, 0.02 * k), 'fill="#000"'));
    parts.push(lbl(0.5, 0.31, "Kopf", 0.035));
    parts.push(lbl(0.5, 0.82, "Brust", 0.045));
    note = "Silhouette · Kopf/Brust";
  } else {
    parts.push(zr(0.22, 0.34, 0.56, 0.74));
    parts.push(zr(0.36, 0.4, 0.28, 0.4));
    parts.push(zr(0.42, 0.06, 0.16, 0.12));
    parts.push(lbl(0.5, 0.6, "A", 0.07));
    parts.push(lbl(0.5, 0.12, "A", 0.04));
    parts.push(lbl(0.29, 0.98, "C", 0.06));
    parts.push(lbl(0.12, 1.3, "D", 0.06));
    parts.push(lbl(0.88, 1.3, "D", 0.06));
  }
  if (variant === "noshoot") {
    // NS-Zone unten rechts: weiss abgedeckt, schraffiert, gestrichelt umrandet
    const x = ox + 0.56 * k;
    const y = oy + 1.0 * k;
    const w = 0.44 * k;
    const h = 0.5 * k;
    parts.push(rect(x, y, w, h, 'fill="#fff"'));
    const sp = Math.max(3, 0.04 * k);
    for (let t = -h; t < w; t += sp) {
      const u0 = Math.max(0, -t);
      const u1 = Math.min(h, w - t);
      if (u1 <= u0) continue;
      parts.push(line(x + t + u0, y + h - u0, x + t + u1, y + h - u1, 0.3, "#999"));
    }
    parts.push(rect(x, y, w, h, 'fill="none" stroke="#000" stroke-width="1" stroke-dasharray="3 2"'));
    const bw = 0.2 * k;
    const bh = 0.11 * k;
    parts.push(rect(x + w / 2 - bw / 2, y + h / 2 - bh / 2, bw, bh, 'fill="#fff" stroke="#000" stroke-width="0.6"'));
    parts.push(text(x + w / 2, y + h / 2, 0.08 * k, "NS", 'fill="#000" font-weight="bold" text-anchor="middle" dominant-baseline="central"'));
    note = "Silhouette · NS = nicht beschiessen";
  }
  return { body: parts.join("\n"), note };
}
