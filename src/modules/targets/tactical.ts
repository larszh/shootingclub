import { circle, clamp, fmtM, formatRatio, int, joinNote, line, n, range, rect, rng, shuffle, text, type Body, type Box, type Ctx } from "./svg-kit";

/**
 * Taktik & Polizei: abstrakte, gesichtslose Figuren in Schwarz-Weiss für
 * Ausbildung und Training. Zonen A (Zentrum, höchste Wertung), C, D und
 * NS (No-Shoot, grau schraffiert). Rein und deterministisch – Anordnungen
 * kommen aus einem Startwert (seed), nie aus Math.random.
 *
 * Figuren werden in Einheiten gezeichnet: Breite 1, Höhe bis 1.5 (Brustbild).
 * Eine Einheit entspricht in Originalgrösse 460 mm (Schulterbreite).
 */

export const TACTICAL_KEYS: ReadonlySet<string> = new Set([
  "TAC_HOSTAGE",
  "TAC_HOSTAGE_HEAD",
  "TAC_HOSTAGE_TWO",
  "TAC_HOSTAGE_KNEEL",
  "TAC_SHOOT_NOSHOOT",
  "TAC_CROWD",
  "TAC_COVER_LOW",
  "TAC_COVER_SIDE",
  "TAC_COVER_WINDOW",
  "TAC_COVER_VEHICLE",
  "TAC_HEAD_BOXES",
  "TAC_SEQUENCE",
  "TAC_CODED_SHAPES",
  "TAC_MOVER",
  "TAC_TURNED",
  "TAC_LOW_LIGHT",
]);

/** Originalgrösse einer Figuren-Einheit in mm (für die Distanz-Umrechnung). */
const FIGURE_UNIT_MM = 460;
/** Originalbreite einer Kopfzone in mm. */
const HEAD_BOX_MM = 150;

const ZONES_LINE = "Zonen: A = Zentrum (höchste Wertung) · C · D · NS = No-Shoot (Treffer = Abzug)";
const COVER_LINE = "Treffer in der Deckung zählen nicht.";

export function renderTactical(subject: string, c: Ctx): Body {
  switch (subject) {
    case "TAC_HOSTAGE":
      return sceneSheet(c, subject, hostageScene(side(c, "right")), "Geiselnahme · Bedroher teilweise verdeckt", [ZONES_LINE, "Geisel (grau schraffiert) = NS. Nur freie Flächen des Bedrohers werten."]);
    case "TAC_HOSTAGE_HEAD":
      return sceneSheet(c, subject, hostageHeadScene(side(c, "left")), "Geiselnahme · nur Kopf frei", [ZONES_LINE, "Geisel = NS. Nur der sichtbare Kopfteil des Bedrohers ist gültig – höchste Präzision."]);
    case "TAC_HOSTAGE_TWO":
      return sceneSheet(c, subject, hostageTwoScene(), "Geiselnahme · zwei Geiseln", [ZONES_LINE, "Beide Geiseln = NS. Nur Kopf und freier Streifen des Bedrohers werten."]);
    case "TAC_HOSTAGE_KNEEL":
      return sceneSheet(c, subject, hostageKneelScene(side(c, "right")), "Geiselnahme · Geisel kniend", [ZONES_LINE, "Kniende Geisel = NS. Kopf und obere Brust des Bedrohers sind frei."]);
    case "TAC_SHOOT_NOSHOOT":
      return shootNoShoot(c, subject);
    case "TAC_CROWD":
      return crowd(c, subject);
    case "TAC_COVER_LOW":
      return sceneSheet(c, subject, coverLowScene(c), "Teildeckung tief", [ZONES_LINE, `Nur freie Flächen werten. ${COVER_LINE}`]);
    case "TAC_COVER_SIDE":
      return sceneSheet(c, subject, coverSideScene(c), "Barrikade / Türrahmen", [ZONES_LINE, `Nur Schulter und Kopfseite sind frei. ${COVER_LINE}`]);
    case "TAC_COVER_WINDOW":
      return sceneSheet(c, subject, coverWindowScene(c), "Fenster-Öffnung", [ZONES_LINE, `Nur durch das Fenster schiessen. ${COVER_LINE}`]);
    case "TAC_COVER_VEHICLE":
      return sceneSheet(c, subject, vehicleScene(c), "Fahrzeug-Deckung", [ZONES_LINE, `Fahrzeug und Scheiben = Deckung. ${COVER_LINE}`]);
    case "TAC_HEAD_BOXES":
      return headBoxes(c, subject);
    case "TAC_SEQUENCE":
      return sequence(c, subject);
    case "TAC_CODED_SHAPES":
      return codedShapes(c, subject);
    case "TAC_MOVER":
      return mover(c, subject);
    case "TAC_TURNED":
      return turned(c, subject);
    case "TAC_LOW_LIGHT":
      return lowLight(c, subject);
    default:
      return { body: "", note: null };
  }
}

// ---------------------------------------------------------------------------
// Grundlagen: IDs, Muster, Legende, Raster, Massstab
// ---------------------------------------------------------------------------

type G = { uid: string };

/** Stabile, kurze ID je Sujet/Format/Parameter (für Muster und Clip-Pfade im selben Dokument). */
function makeUid(subject: string, c: Ctx) {
  const s = `${subject}|${c.size}|${JSON.stringify(c.p)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `tac${(h >>> 0).toString(36)}`;
}

/** Muster: NS-Schraffur (grau), Streifen, Punkte, Gitter, Mauerwerk. */
function defs(uid: string) {
  return `<defs>
<pattern id="${uid}-h" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2.2" stroke="#6f6f6f" stroke-width="0.4"/></pattern>
<pattern id="${uid}-s" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect x="0" y="0" width="1.1" height="2.6" fill="#000"/></pattern>
<pattern id="${uid}-d" width="2.4" height="2.4" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="0.6" fill="#000"/></pattern>
<pattern id="${uid}-x" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect x="0" y="0" width="0.5" height="2.6" fill="#000"/><rect x="0" y="0" width="2.6" height="0.5" fill="#000"/></pattern>
<pattern id="${uid}-b" width="8" height="4" patternUnits="userSpaceOnUse"><path d="M0 0.1 H8 M0 2.1 H8 M0.1 0 V2 M4 2 V4" stroke="#9a9a9a" stroke-width="0.25" fill="none"/></pattern>
</defs>`;
}

type Sheet = { g: G; area: Box; parts: string[] };

/**
 * Bereitet das Blatt vor: Muster, optional dunkler Hintergrund, Legende unten.
 * Liefert die verbleibende Fläche für die Ziele.
 */
function sheet(c: Ctx, subject: string, legendLines: string[], dark = false): Sheet {
  const uid = makeUid(subject, c);
  const parts = [defs(uid)];
  if (dark) parts.push(rect(c.box.x, c.box.y, c.box.w, c.box.h, 'fill="#000"'));
  let area = c.box;
  if ((c.p.legend ?? true) && legendLines.length) {
    const lg = legend(c.box, legendLines, dark);
    parts.push(lg.svg);
    area = { ...c.box, h: c.box.h - lg.h };
  }
  return { g: { uid }, area, parts };
}

/** Kleine Legende am unteren Rand der Zielfläche (zusammengedrückt statt abgeschnitten). */
function legend(box: Box, lines: string[], dark: boolean) {
  const fs = clamp(box.w / 72, 1.7, 2.5);
  const lh = fs * 1.4;
  const h = lines.length * lh + 2.4;
  const top = box.y + box.h - h;
  const color = dark ? "#fff" : "#333";
  const parts = [line(box.x, top + 0.8, box.x + box.w, top + 0.8, 0.2, dark ? "#fff" : "#999")];
  const pad = dark ? 1.5 : 0;
  const maxW = box.w - 2 * pad;
  lines.forEach((s, i) => {
    const est = s.length * 0.5 * fs;
    const fit = est > maxW ? ` textLength="${n(maxW)}" lengthAdjust="spacingAndGlyphs"` : "";
    parts.push(text(box.x + pad, top + 1.8 + lh * (i + 0.5), fs, s, `fill="${color}" dominant-baseline="central"${fit}`));
  });
  return { svg: parts.join("\n"), h };
}

/** Bestes Raster für count Zellen (Zellgrösse in Einheiten uw × uh); k = mm pro Einheit. */
function fitGrid(count: number, area: Box, uw: number, uh: number) {
  let best = { cols: 1, rows: count, k: 0 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const k = Math.min(area.w / cols / uw, area.h / rows / uh);
    if (k > best.k + 1e-9) best = { cols, rows, k };
  }
  return { ...best, cellW: area.w / best.cols, cellH: area.h / best.rows };
}

/**
 * Distanz-Umrechnung: Originalgrösse × Schussdistanz / Originaldistanz,
 * begrenzt auf den Platz. Ohne beide Distanzen: so gross wie möglich.
 */
function distanceScale(c: Ctx, fitK: number, unitMm: number): { k: number; note: string | null } {
  const orig = c.p.originalDistanceM;
  const shot = c.p.shotDistanceM;
  if (!orig || !shot || Math.abs(orig - shot) < 1e-6) return { k: fitK, note: null };
  const want = (unitMm * shot) / orig;
  const k = Math.min(want, fitK);
  const parts = [`Massstab ${formatRatio(k / unitMm)}`, `simuliert ${fmtM(orig)} m auf ${fmtM(shot)} m`];
  if (want > fitK + 0.01) parts.push(`zu gross für ${c.size}, verkleinert (Soll ${formatRatio(shot / orig)})`);
  return { k, note: parts.join(" · ") };
}

function side(c: Ctx, def: "left" | "right"): 1 | -1 {
  const v = c.p.variant === "left" || c.p.variant === "right" ? c.p.variant : def;
  return v === "right" ? 1 : -1;
}

/** Nummern-Marke (schwarzes Quadrat, weisse Zahl) für Ansagen. */
function tag(x: number, y: number, s: number, label: string, dark = false) {
  return [
    rect(x, y, s, s, `fill="${dark ? "#fff" : "#000"}" rx="${n(s * 0.18)}"`),
    text(x + s / 2, y + s / 2, s * (label.length > 2 ? 0.42 : 0.6), label, `fill="${dark ? "#000" : "#fff"}" font-weight="bold" text-anchor="middle" dominant-baseline="central"`),
  ].join("\n");
}

function bold(color = "#000") {
  return `fill="${color}" font-weight="bold" text-anchor="middle" dominant-baseline="central"`;
}

// ---------------------------------------------------------------------------
// Figur
// ---------------------------------------------------------------------------

type FigStyle = "target" | "ns" | "dark" | "minimal" | "ghost";
type FigOpts = {
  style: FigStyle;
  /** Trefferzonen zeichnen */
  zones?: boolean;
  /** Breitenfaktor: 1 = frontal, 0.72 = halb gedreht, 0.45 = Profil */
  sx?: number;
  /** Unterkante in Figuren-Einheiten (Standard 1.5) */
  bottom?: number;
  /** Blickrichtung für Arm/Profil: 1 = rechts, -1 = links */
  facing?: 1 | -1;
  /** Abstrakter Arm nach vorne (Profilfiguren) */
  arm?: boolean;
};

/**
 * Neutrale Brustbild-Figur ohne Gesicht. (x, y) = linke obere Ecke der
 * Einheitsbox, k = Breite in mm.
 */
function figure(g: G, x: number, y: number, k: number, o: FigOpts): string {
  const sx = o.sx ?? 1;
  const B = Math.max(0.9, o.bottom ?? 1.5);
  const facing = o.facing ?? 1;
  const X = (u: number) => x + (0.5 + (u - 0.5) * sx) * k;
  const Y = (v: number) => y + v * k;
  const P = (u: number, v: number) => `${n(X(u))} ${n(Y(v))}`;
  const sw = o.style === "dark" ? 0.35 : o.style === "minimal" ? 0.25 : clamp(k * 0.012, 0.35, 0.9);
  const stroke = o.style === "dark" ? "#fff" : o.style === "minimal" ? "#999" : o.style === "ghost" ? "#666" : "#000";
  const fill = o.style === "ns" ? "#e4e4e4" : o.style === "dark" ? "#000" : o.style === "target" ? "#fff" : "none";
  const dash = o.style === "ghost" ? ` stroke-dasharray="${n(sw * 5)} ${n(sw * 3)}"` : "";
  const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="${n(sw)}" stroke-linejoin="round"${dash}`;
  const torso = `M ${P(0.44, 0.255)} L ${P(0.44, 0.29)} C ${P(0.25, 0.3)} ${P(0.08, 0.32)} ${P(0.05, 0.42)} L ${P(0.02, B)} L ${P(0.98, B)} L ${P(0.95, 0.42)} C ${P(0.92, 0.32)} ${P(0.75, 0.3)} ${P(0.56, 0.29)} L ${P(0.56, 0.255)} Z`;
  // Kopf: im Profil leicht in Blickrichtung versetzt, nie schmaler als 80 %
  const hcx = x + 0.5 * k + (sx < 1 ? facing * 0.03 * k : 0);
  const hrx = 0.115 * k * Math.max(sx, 0.8);
  const head = `<ellipse cx="${n(hcx)}" cy="${n(Y(0.14))}" rx="${n(hrx)}" ry="${n(0.135 * k)}" ${attrs}/>`;
  const parts: string[] = [];
  if (o.arm) {
    // Abstrakter Arm in Blickrichtung, beginnt im Körper (der Rumpf überdeckt das innere Ende)
    const edge = x + 0.5 * k + facing * 0.45 * sx * k;
    const len = 0.26 * k;
    const ax = facing > 0 ? edge - 0.08 * k : edge - len + 0.08 * k;
    parts.push(rect(ax, Y(0.47), len, 0.085 * k, `${attrs} rx="${n(0.03 * k)}"`));
    if (o.style === "ns") parts.push(rect(ax, Y(0.47), len, 0.085 * k, `fill="url(#${g.uid}-h)" rx="${n(0.03 * k)}"`));
  }
  parts.push(`<path d="${torso}" ${attrs}/>`);
  if (o.style === "ns") parts.push(`<path d="${torso}" fill="url(#${g.uid}-h)"/>`);
  parts.push(head);
  if (o.style === "ns") parts.push(`<ellipse cx="${n(hcx)}" cy="${n(Y(0.14))}" rx="${n(hrx)}" ry="${n(0.135 * k)}" fill="url(#${g.uid}-h)"/>`);

  if (o.style === "ns") {
    const bw = 0.3 * k;
    const bh = 0.15 * k;
    parts.push(rect(x + 0.5 * k - bw / 2, Y(0.6) - bh / 2, bw, bh, `fill="#fff" stroke="#000" stroke-width="${n(sw)}" rx="${n(0.02 * k)}"`));
    parts.push(text(x + 0.5 * k, Y(0.6), 0.1 * k, "NS", bold()));
    return parts.join("\n");
  }
  if (!o.zones) return parts.join("\n");

  const zc = o.style === "dark" ? "#fff" : o.style === "minimal" ? "#b5b5b5" : o.style === "ghost" ? "#777" : "#000";
  const zsw = o.style === "minimal" ? 0.2 : Math.max(0.25, sw * 0.6);
  const zdash = o.style === "target" ? "" : ` stroke-dasharray="${n(zsw * 6)} ${n(zsw * 4)}"`;
  const zr = (cx: number, hw: number, y0: number, y1: number) =>
    rect(cx - hw * k, Y(y0), 2 * hw * k, (y1 - y0) * k, `fill="none" stroke="${zc}" stroke-width="${n(zsw)}" rx="${n(0.02 * k)}"${zdash}`);
  const cx = x + 0.5 * k;
  const hwA = 0.14 * sx;
  const hwC = 0.28 * sx;
  const hwH = 0.075 * Math.max(sx, 0.8);
  const cBottom = Math.min(1.08, B - 0.06);
  const aBottom = Math.min(0.8, cBottom - 0.08);
  parts.push(zr(cx, hwC, 0.34, cBottom));
  parts.push(zr(cx, hwA, 0.4, aBottom));
  parts.push(zr(hcx, hwH, 0.06, 0.17));
  const lc = o.style === "dark" ? "#fff" : o.style === "minimal" ? "#999" : o.style === "ghost" ? "#666" : "#000";
  const ls = clamp(sx, 0.6, 1);
  parts.push(text(cx, Y((0.4 + aBottom) / 2), 0.075 * k * ls, "A", bold(lc)));
  parts.push(text(hcx, Y(0.115), 0.045 * k, "A", bold(lc)));
  if (cBottom - aBottom > 0.12) parts.push(text(cx, Y((aBottom + cBottom) / 2), 0.06 * k * ls, "C", bold(lc)));
  else parts.push(text(cx - (hwA + (hwC - hwA) / 2) * k, Y(0.6), 0.05 * k * ls, "C", bold(lc)));
  if (sx >= 0.7 && B > 1.2) {
    parts.push(text(x + (0.5 - 0.38 * sx) * k, Y(B - 0.14), 0.055 * k, "D", bold(lc)));
    parts.push(text(x + (0.5 + 0.38 * sx) * k, Y(B - 0.14), 0.055 * k, "D", bold(lc)));
  } else if (B > 1.0) {
    parts.push(text(cx, Y(B - 0.08), 0.045 * k, "D", bold(lc)));
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Piktogramme (Hand-Gegenstände), Masse relativ zur Grösse s
// ---------------------------------------------------------------------------

type Picto = "pistol" | "phone" | "wallet" | "hand" | "badge";
const NON_THREATS: Picto[] = ["phone", "wallet", "hand", "badge"];

function picto(kind: Picto, cx: number, cy: number, s: number, mirror: boolean): string {
  const m = mirror ? -1 : 1;
  const X = (u: number) => n(cx + u * s * m);
  const Y = (v: number) => n(cy + v * s);
  const poly = (pts: [number, number][], attrs = 'fill="#000"') => `<polygon points="${pts.map(([u, v]) => `${X(u)},${Y(v)}`).join(" ")}" ${attrs}/>`;
  const r = (u: number, v: number, w: number, h: number, attrs: string) => rect(cx + (mirror ? -(u + w) : u) * s, cy + v * s, w * s, h * s, attrs);
  const parts = [circle(cx, cy, s * 0.62, `fill="#fff" stroke="#000" stroke-width="${n(clamp(s * 0.04, 0.25, 0.6))}"`)];
  switch (kind) {
    case "pistol":
      parts.push(poly([[-0.48, -0.3], [0.48, -0.3], [0.48, -0.1], [0.02, -0.1], [-0.04, 0.02], [-0.12, 0.02], [-0.16, 0.4], [-0.44, 0.4], [-0.3, -0.1], [-0.48, -0.1]]));
      parts.push(`<path d="M ${X(-0.12)} ${Y(-0.1)} Q ${X(-0.06)} ${Y(0.16)} ${X(0.06)} ${Y(-0.1)}" fill="none" stroke="#000" stroke-width="${n(s * 0.05)}"/>`);
      break;
    case "phone":
      parts.push(r(-0.2, -0.4, 0.4, 0.8, `fill="#000" rx="${n(s * 0.07)}"`));
      parts.push(r(-0.14, -0.31, 0.28, 0.56, 'fill="#fff"'));
      parts.push(circle(cx, cy + 0.33 * s, s * 0.035, 'fill="#fff"'));
      break;
    case "wallet":
      parts.push(r(-0.42, -0.27, 0.84, 0.54, `fill="#000" rx="${n(s * 0.06)}"`));
      parts.push(r(0.12, -0.1, 0.34, 0.2, `fill="#fff" rx="${n(s * 0.05)}"`));
      parts.push(circle(cx + 0.24 * s * m, cy, s * 0.045, 'fill="#000"'));
      break;
    case "hand":
      parts.push(r(-0.22, -0.04, 0.44, 0.44, `fill="#000" rx="${n(s * 0.1)}"`));
      for (const u of [-0.21, -0.1, 0.01, 0.12]) parts.push(r(u, -0.42, 0.09, 0.46, `fill="#000" rx="${n(s * 0.045)}"`));
      parts.push(poly([[0.18, 0.16], [0.4, -0.06], [0.47, 0.01], [0.24, 0.3]]));
      break;
    case "badge":
      parts.push(`<path d="M ${X(0)} ${Y(-0.42)} L ${X(0.36)} ${Y(-0.3)} L ${X(0.32)} ${Y(0.1)} Q ${X(0.25)} ${Y(0.32)} ${X(0)} ${Y(0.44)} Q ${X(-0.25)} ${Y(0.32)} ${X(-0.32)} ${Y(0.1)} L ${X(-0.36)} ${Y(-0.3)} Z" fill="#000"/>`);
      parts.push(circle(cx, cy - 0.02 * s, s * 0.13, 'fill="#fff"'));
      break;
  }
  return parts.join("\n");
}

/** Gegenstand in der Hand einer Figur (Einheitsbox x, y, Breite k). */
function handItem(x: number, y: number, k: number, kind: Picto, facing: 1 | -1) {
  return picto(kind, x + (0.5 + facing * 0.27) * k, y + 0.7 * k, 0.21 * k, facing < 0);
}

// ---------------------------------------------------------------------------
// Szenen (Geiselnahme, Deckung) mit gemeinsamem Blatt-Layout
// ---------------------------------------------------------------------------

type Scene = { w: number; h: number; draw: (g: G, x: number, y: number, k: number, idx: number) => string };

function sceneSheet(c: Ctx, subject: string, scene: Scene, title: string, legendLines: string[]): Body {
  const { p } = c;
  const { g, area, parts } = sheet(c, subject, legendLines);
  const count = int(p.count, 1, 1, 4);
  const pad = 0.08;
  const grid = fitGrid(count, area, scene.w + 2 * pad, scene.h + 2 * pad);
  const fitK = grid.k * 0.98;
  const sc = distanceScale(c, fitK, FIGURE_UNIT_MM);
  const k = sc.k;
  const numbers = p.numbers ?? true;
  for (let i = 0; i < count; i++) {
    const col = i % grid.cols;
    const row = Math.floor(i / grid.cols);
    const cx = area.x + grid.cellW * (col + 0.5);
    const cy = area.y + grid.cellH * (row + 0.5);
    const x = cx - (scene.w * k) / 2;
    const y = cy - (scene.h * k) / 2;
    parts.push(scene.draw(g, x, y, k, i));
    if (numbers && count > 1) parts.push(tag(area.x + grid.cellW * col + 1, area.y + grid.cellH * row + 1, clamp(k * 0.12, 4, 9), String(i + 1)));
    if (count > 1 && col > 0) parts.push(line(area.x + grid.cellW * col, area.y + grid.cellH * row + 2, area.x + grid.cellW * col, area.y + grid.cellH * (row + 1) - 2, 0.2, "#999", 'stroke-dasharray="1 1"'));
    if (count > 1 && row > 0 && col === 0) parts.push(line(area.x + 2, area.y + grid.cellH * row, area.x + area.w - 2, area.y + grid.cellH * row, 0.2, "#999", 'stroke-dasharray="1 1"'));
  }
  return { body: parts.join("\n"), note: joinNote(title, sc.note) };
}

/** Bedroher hinten, Geisel davor seitlich versetzt (s = 1: Geisel rechts). */
function hostageScene(s: 1 | -1): Scene {
  const off = 0.13;
  return {
    w: 1 + off,
    h: 1.6,
    draw: (g, x, y, k) => {
      const tx = s > 0 ? 0 : off;
      const hx = s > 0 ? off : 0;
      return [
        figure(g, x + tx * k, y, k, { style: "target", zones: true, bottom: 1.6 }),
        figure(g, x + hx * k, y + 0.07 * k, k, { style: "ns", bottom: 1.53 }),
      ].join("\n");
    },
  };
}

/** Nur der Kopf des Bedrohers ragt neben dem Kopf der Geisel hervor. */
function hostageHeadScene(s: 1 | -1): Scene {
  const off = 0.17;
  return {
    w: 1 + off,
    h: 1.6,
    draw: (g, x, y, k, idx) => {
      const tx = s > 0 ? 0 : off;
      const hx = s > 0 ? off : 0;
      const id = `${g.uid}-c${idx}`;
      return [
        `<clipPath id="${id}">${rect(x, y, (1 + off) * k, 0.4 * k, "")}</clipPath>`,
        `<g clip-path="url(#${id})">${figure(g, x + tx * k, y + 0.12 * k, k, { style: "target", zones: true, bottom: 1.48 })}</g>`,
        figure(g, x + hx * k, y + 0.1 * k, k, { style: "ns", bottom: 1.5 }),
      ].join("\n");
    },
  };
}

/** Bedroher zwischen zwei Geiseln. */
function hostageTwoScene(): Scene {
  return {
    w: 1.7,
    h: 1.6,
    draw: (g, x, y, k) =>
      [
        figure(g, x + 0.35 * k, y, k, { style: "target", zones: true, bottom: 1.6 }),
        figure(g, x, y + 0.12 * k, k, { style: "ns", bottom: 1.48 }),
        figure(g, x + 0.7 * k, y + 0.12 * k, k, { style: "ns", bottom: 1.48 }),
      ].join("\n"),
  };
}

/** Geisel kniet vor dem Bedroher. */
function hostageKneelScene(s: 1 | -1): Scene {
  const off = 0.14;
  return {
    w: 1 + off,
    h: 1.6,
    draw: (g, x, y, k) => {
      const tx = s > 0 ? 0 : off;
      const hx = s > 0 ? off : 0;
      return [
        figure(g, x + tx * k, y, k, { style: "target", zones: true, bottom: 1.6 }),
        figure(g, x + hx * k, y + 0.62 * k, k, { style: "ns", bottom: 0.98 }),
      ].join("\n");
    },
  };
}

/** Deckungsfläche: weiss, Mauerwerk-Muster, kräftiger Rand, optional Beschriftung. */
function coverShape(g: G, d: string, k: number, labelAt?: { x: number; y: number; w: number }) {
  const sw = clamp(k * 0.014, 0.5, 1.2);
  const parts = [
    `<path d="${d}" fill="#fff" fill-rule="evenodd"/>`,
    `<path d="${d}" fill="url(#${g.uid}-b)" fill-rule="evenodd"/>`,
    `<path d="${d}" fill="none" stroke="#000" stroke-width="${n(sw)}" stroke-linejoin="round"/>`,
  ];
  if (labelAt && labelAt.w > 14) {
    const fs = clamp(labelAt.w * 0.09, 2.2, 5);
    parts.push(rect(labelAt.x - fs * 2.6, labelAt.y - fs * 0.75, fs * 5.2, fs * 1.5, `fill="#fff" stroke="#000" stroke-width="0.25" rx="${n(fs * 0.3)}"`));
    parts.push(text(labelAt.x, labelAt.y, fs, "DECKUNG", bold("#555")));
  }
  return parts.join("\n");
}
function boxPath(x: number, y: number, w: number, h: number) {
  return `M ${n(x)} ${n(y)} H ${n(x + w)} V ${n(y + h)} H ${n(x)} Z`;
}

function coverPct(c: Ctx, def: number) {
  return int(c.p.coverPct, def, 10, 90) / 100;
}

/** Figur hinter Mauer oder Kisten, nur Oberkörper frei. */
function coverLowScene(c: Ctx): Scene {
  const pct = coverPct(c, 45);
  const crates = c.p.variant === "crates";
  const W = 1.3;
  const H = 1.5;
  const top = clamp(H * (1 - pct), 0.3, 1.4);
  return {
    w: W,
    h: H,
    draw: (g, x, y, k) => {
      const parts = [figure(g, x + 0.15 * k, y, k, { style: "target", zones: true, bottom: H })];
      if (crates) {
        const t2 = Math.min(H - 0.08, top + 0.14);
        parts.push(coverShape(g, boxPath(x, y + t2 * k, 0.62 * k, (H - t2) * k), k));
        parts.push(coverShape(g, boxPath(x + 0.62 * k, y + top * k, (W - 0.62) * k, (H - top) * k), k, { x: x + 0.96 * k, y: y + ((top + H) / 2) * k, w: 0.68 * k }));
      } else {
        parts.push(coverShape(g, boxPath(x, y + top * k, W * k, (H - top) * k), k, { x: x + (W / 2) * k, y: y + ((top + H) / 2) * k, w: W * k }));
      }
      return parts.join("\n");
    },
  };
}

/** Seitliche Deckung oder Türrahmen. */
function coverSideScene(c: Ctx): Scene {
  const pct = coverPct(c, 55);
  const v = c.p.variant === "left" || c.p.variant === "door" ? c.p.variant : "right";
  const W = 1.3;
  const H = 1.5;
  return {
    w: W,
    h: H,
    draw: (g, x, y, k) => {
      const parts = [figure(g, x + 0.15 * k, y, k, { style: "target", zones: true, bottom: H })];
      const jamb = (jx: number) => rect(jx - 0.025 * k, y, 0.05 * k, H * k, 'fill="#000"');
      if (v === "door") {
        const ow = clamp(1 - pct, 0.2, 0.9);
        const oc = 0.65 + 0.12;
        const l = oc - ow / 2;
        const r = oc + ow / 2;
        parts.push(coverShape(g, boxPath(x, y, l * k, H * k), k, { x: x + (l / 2) * k, y: y + 1.2 * k, w: l * k }));
        parts.push(coverShape(g, boxPath(x + r * k, y, (W - r) * k, H * k), k, { x: x + ((r + W) / 2) * k, y: y + 1.2 * k, w: (W - r) * k }));
        parts.push(jamb(x + l * k), jamb(x + r * k));
        parts.push(rect(x, y, W * k, 0.03 * k, 'fill="#000"'));
      } else {
        // Deckungskante nie über die Kopfmitte hinaus: Kopf-A-Zone und eine Schulter bleiben immer frei.
        // Kopfmitte liegt bei 0.65 (Figur bei 0.15), Pfosten 0.05 breit → Kante ab 0.70.
        const xs = Math.max(0.65 + 0.05, 0.15 + (1 - pct));
        const from = v === "right" ? xs : 0;
        const to = v === "right" ? W : W - xs;
        parts.push(coverShape(g, boxPath(x + from * k, y, (to - from) * k, H * k), k, { x: x + ((from + to) / 2) * k, y: y + 1.2 * k, w: (to - from) * k }));
        parts.push(jamb(x + (v === "right" ? from : to) * k));
      }
      return parts.join("\n");
    },
  };
}

/** Wand mit Fensteröffnung. */
function coverWindowScene(c: Ctx): Scene {
  const pct = coverPct(c, 55);
  const v = c.p.variant === "offset" || c.p.variant === "cross" ? c.p.variant : "center";
  const W = 1.4;
  const H = 1.5;
  const ow = clamp(1.3 * (1 - pct), 0.3, 1.2);
  const oh = clamp(ow * 1.05, 0.3, 1.3);
  const ocx = 0.7 + (v === "offset" ? 0.26 : 0);
  const ox = clamp(ocx - ow / 2, 0.04, W - ow - 0.04);
  const oy = clamp(0.5 - oh / 2, 0.03, H - oh - 0.03);
  return {
    w: W,
    h: H,
    draw: (g, x, y, k) => {
      const parts = [figure(g, x + 0.2 * k, y + 0.16 * k, k, { style: "target", zones: true, bottom: H - 0.16 })];
      const d = `${boxPath(x, y, W * k, H * k)} ${boxPath(x + ox * k, y + oy * k, ow * k, oh * k)}`;
      parts.push(coverShape(g, d, k, { x: x + (W / 2) * k, y: y + ((oy + oh + H) / 2) * k, w: W * k }));
      const fsw = clamp(k * 0.03, 0.8, 2.5);
      parts.push(rect(x + ox * k, y + oy * k, ow * k, oh * k, `fill="none" stroke="#000" stroke-width="${n(fsw)}"`));
      if (v === "cross") {
        const bw = 0.045 * k;
        const bx = x + (ox + ow / 2) * k - bw / 2;
        const by = y + (oy + oh * 0.42) * k - bw / 2;
        parts.push(rect(bx, y + oy * k, bw, oh * k, `fill="#fff" stroke="#000" stroke-width="${n(fsw * 0.4)}"`));
        parts.push(rect(x + ox * k, by, ow * k, bw, `fill="#fff" stroke="#000" stroke-width="${n(fsw * 0.4)}"`));
      }
      return parts.join("\n");
    },
  };
}

/** Abstrakter Fahrzeug-Umriss (Seitenansicht) vor der Figur. */
function vehicleScene(c: Ctx): Scene {
  const hood = c.p.variant === "hood";
  const W = 2.2;
  const H = 1.5;
  return {
    w: W,
    h: H,
    draw: (g, x, y, k) => {
      const P = (u: number, v: number) => `${n(x + u * k)} ${n(y + v * k)}`;
      const parts: string[] = [];
      if (hood) parts.push(figure(g, x + 1.2 * k, y + 0.26 * k, k, { style: "target", zones: true, bottom: 1.04 }));
      else parts.push(figure(g, x + 0.6 * k, y + 0.12 * k, k, { style: "target", zones: true, bottom: 1.08 }));
      const body = `M ${P(0.05, 1.3)} L ${P(0.05, 0.95)} Q ${P(0.05, 0.85)} ${P(0.15, 0.85)} L ${P(0.55, 0.85)} L ${P(0.75, 0.55)} L ${P(1.45, 0.55)} L ${P(1.7, 0.85)} L ${P(2.1, 0.88)} Q ${P(2.2, 0.9)} ${P(2.2, 1.0)} L ${P(2.2, 1.3)} Z`;
      parts.push(coverShape(g, body, k, { x: x + 1.1 * k, y: y + 1.08 * k, w: 0.9 * k }));
      const win = (pts: [number, number][]) => {
        const d = `M ${pts.map(([u, v]) => P(u, v)).join(" L ")} Z`;
        return `<path d="${d}" fill="#d6d6d6"/><path d="${d}" fill="url(#${g.uid}-h)"/><path d="${d}" fill="none" stroke="#000" stroke-width="${n(clamp(k * 0.01, 0.35, 0.8))}"/>`;
      };
      parts.push(win([[0.8, 0.6], [1.07, 0.6], [1.07, 0.82], [0.64, 0.82]]));
      parts.push(win([[1.13, 0.6], [1.42, 0.6], [1.6, 0.82], [1.13, 0.82]]));
      for (const wx of [0.48, 1.75]) {
        parts.push(circle(x + wx * k, y + 1.3 * k, 0.17 * k, 'fill="#000"'));
        parts.push(circle(x + wx * k, y + 1.3 * k, 0.07 * k, 'fill="#fff"'));
      }
      parts.push(line(x, y + 1.48 * k, x + W * k, y + 1.48 * k, clamp(k * 0.01, 0.3, 0.8)));
      return parts.join("\n");
    },
  };
}

// ---------------------------------------------------------------------------
// Entscheidung, Gruppe
// ---------------------------------------------------------------------------

function shootNoShoot(c: Ctx, subject: string): Body {
  const { p } = c;
  const count = int(p.count, 6, 4, 6);
  const wantedThreats = int(p.threats, 2, 0, 99);
  const threats = Math.min(wantedThreats, count);
  const seed = int(p.seed, 1, 0, 9999);
  const marked = p.variant === "marked";
  const numbers = p.numbers ?? true;
  const { g, area, parts } = sheet(c, subject, [
    ZONES_LINE,
    marked ? "Lernversion: Figuren ohne Waffe sind als NS markiert." : "Nur Figuren mit Pistolen-Symbol beschiessen. Telefon, Portemonnaie, offene Hand, Ausweis = NS.",
  ]);
  const order = shuffle(range(0, count - 1), seed);
  const threatSet = new Set(order.slice(0, threats));
  const r = rng(seed + 101);
  const B = 1.25;
  const grid = fitGrid(count, area, 1.12, B + 0.12);
  const k = grid.k;
  for (let i = 0; i < count; i++) {
    const col = i % grid.cols;
    const row = Math.floor(i / grid.cols);
    const x = area.x + grid.cellW * (col + 0.5) - k / 2;
    const y = area.y + grid.cellH * (row + 0.5) - ((B + 0.06) * k) / 2 + 0.06 * k;
    const threat = threatSet.has(i);
    const item: Picto = threat ? "pistol" : NON_THREATS[Math.floor(r() * NON_THREATS.length)];
    const facing: 1 | -1 = r() < 0.5 ? 1 : -1;
    const ns = marked && !threat;
    parts.push(figure(g, x, y, k, { style: ns ? "ns" : "target", zones: !ns, bottom: B }));
    parts.push(handItem(x, y, k, item, facing));
    if (numbers) parts.push(tag(area.x + grid.cellW * col + 1, area.y + grid.cellH * row + 1, clamp(k * 0.13, 4, 9), String(i + 1)));
  }
  return { body: parts.join("\n"), note: `Shoot/No-Shoot · ${count} Figuren · ${threats} ${threats === 1 ? "Bedrohung" : "Bedrohungen"}${wantedThreats > count ? ` (${wantedThreats} gewünscht, nur ${count} Figuren)` : ""} · Anordnung ${seed}` };
}

function crowd(c: Ctx, subject: string): Body {
  const { p } = c;
  const count = int(p.count, 6, 5, 7);
  const seed = int(p.seed, 1, 0, 9999);
  const wanted = int(p.threatPos, 0, 0, 99);
  // Nr. ausserhalb der Figurenzahl: nicht stillschweigend die letzte Figur nehmen, sondern gemäss Anordnung und Hinweis
  const pos = wanted <= count ? wanted : 0;
  const threat = pos > 0 ? pos - 1 : shuffle(range(0, count - 1), seed)[0];
  const numbers = p.numbers ?? true;
  const { g, area, parts } = sheet(c, subject, [ZONES_LINE, "Nur die Figur mit Pistolen-Symbol ist die Bedrohung, alle anderen sind NS (grau schraffiert)."]);
  // Zwei oder drei gestaffelte Reihen: hinten kleiner und höher. Gewählt wird die grössere Darstellung.
  const step = 0.95;
  const plan = [2, 3].map((R) => {
    const sizes = range(0, R - 1).map((r) => Math.floor(count / R) + (r < count % R ? 1 : 0));
    const longer = Math.max(...sizes);
    const rows = sizes.map((m, r) => ({
      m,
      scale: 1 - 0.07 * (R - 1 - r),
      top: r * 0.55,
      offset: ((longer - m) * step) / 2 + (m === longer && r % 2 === 1 ? step / 2 : 0),
    }));
    // Aufeinanderfolgende Reihen nie deckungsgleich: sonst verdecken Kopf und Nummer der vorderen Figur das NS-Schild dahinter.
    for (let i = 1; i < rows.length; i++) {
      if (Math.abs(rows[i].offset - rows[i - 1].offset) < 1e-6) rows[i].offset += step / 2;
    }
    const W = Math.max(...rows.map((row) => row.offset + (row.m - 1) * step + 1));
    const H = (R - 1) * 0.55 + 1.1;
    const k = Math.min(area.w / (W + 0.1), area.h / (H + 0.3));
    return { rows, W, H, k };
  }).reduce((a, b) => (b.k > a.k ? b : a));
  const { k, W, H } = plan;
  const ox = area.x + (area.w - W * k) / 2;
  const oy = area.y + (area.h - (H + 0.15) * k) / 2 + 0.15 * k;
  const r = rng(seed + 211);
  // Nummern von links nach rechts, von der hintersten zur vordersten Reihe
  const figs = plan.rows.flatMap((row) => range(0, row.m - 1).map((i) => ({ cx: row.offset + 0.5 + i * step, top: row.top, scale: row.scale, bottom: (H - row.top) / row.scale })));
  const tags: string[] = [];
  figs.forEach((f, i) => {
    const kk = k * f.scale;
    const x = ox + f.cx * k - kk / 2;
    const y = oy + f.top * k;
    const isThreat = i === threat;
    parts.push(figure(g, x, y, kk, { style: isThreat ? "target" : "ns", zones: isThreat, bottom: f.bottom }));
    const facing: 1 | -1 = r() < 0.5 ? 1 : -1;
    if (isThreat) parts.push(handItem(x, y, kk, "pistol", facing));
    else if (r() < 0.5) parts.push(handItem(x, y, kk, NON_THREATS[Math.floor(r() * NON_THREATS.length)], facing));
    if (numbers) {
      const s = clamp(kk * 0.11, 3.5, 8);
      tags.push(tag(x + kk * 0.5 - s / 2, y - s * 1.1, s, String(i + 1)));
    }
  });
  parts.push(...tags);
  return { body: parts.join("\n"), note: `Gruppe mit Unbeteiligten · ${count} Figuren · ${pos > 0 ? `Bedrohung Nr. ${pos}` : `Anordnung ${seed}`}${wanted > count ? ` · Bedrohung Nr. ${wanted} nicht vorhanden, gemäss Anordnung` : ""}` };
}

// ---------------------------------------------------------------------------
// Kopfzonen
// ---------------------------------------------------------------------------

function headBoxes(c: Ctx, subject: string): Body {
  const { p } = c;
  const variant = p.variant === "triangles" || p.variant === "mixed" ? p.variant : "boxes";
  const count = int(p.count, 6, 1, 12);
  const numbers = p.numbers ?? true;
  const { area, parts } = sheet(c, subject, ["Zonen: A = Zentrum (höchste Wertung) · C = Rest der Kopfzone · ausserhalb = Fehler", "Nummer ansagen, dann ein präziser Schuss. Für kurze Distanzen und hohe Schwierigkeit."]);
  const labelU = numbers ? 0.32 : 0.08;
  const grid = fitGrid(count, area, 1.25, 1.27 + labelU + 0.15);
  const fitW = grid.k;
  const orig = p.originalDistanceM;
  const shot = p.shotDistanceM;
  const dist = !!(orig && shot && Math.abs(orig - shot) > 1e-6);
  const base = p.diameterMm ?? (dist ? HEAD_BOX_MM : undefined);
  const want = base !== undefined ? base * (dist ? shot! / orig! : 1) : undefined;
  const w = want !== undefined ? Math.min(want, fitW) : fitW;
  let note: string | null = `Kopfzonen · Breite ${fmtM(w)} mm`;
  if (dist) note = joinNote(note, `simuliert ${fmtM(orig!)} m auf ${fmtM(shot!)} m`);
  if (want !== undefined && want > fitW + 0.01) note = joinNote(note, `zu gross für ${c.size}, verkleinert`);
  const sw = clamp(w * 0.012, 0.3, 0.8);
  for (let i = 0; i < count; i++) {
    const col = i % grid.cols;
    const row = Math.floor(i / grid.cols);
    const cx = area.x + grid.cellW * (col + 0.5);
    const blockH = 1.27 * w + labelU * w;
    const top = area.y + grid.cellH * (row + 0.5) - blockH / 2;
    const tri = variant === "triangles" || (variant === "mixed" && i % 2 === 1);
    if (tri) {
      const th = 0.95 * w;
      const ty = top + (1.27 * w - th) / 2;
      const pts = (s: number) => {
        const gy = ty + th / 3; // Schwerpunkt des umgekehrten Dreiecks
        const P = (px: number, py: number) => `${n(cx + (px - cx) * s)},${n(gy + (py - gy) * s)}`;
        return `${P(cx - w / 2, ty)} ${P(cx + w / 2, ty)} ${P(cx, ty + th)}`;
      };
      parts.push(`<polygon points="${pts(1)}" fill="#fff" stroke="#000" stroke-width="${n(sw)}" stroke-linejoin="round"/>`);
      parts.push(`<polygon points="${pts(0.45)}" fill="none" stroke="#000" stroke-width="${n(sw * 0.8)}" stroke-linejoin="round"/>`);
      parts.push(text(cx, ty + th / 3, w * 0.1, "A", bold()));
      parts.push(text(cx, ty + th * 0.08 + w * 0.05, w * 0.07, "C", bold()));
    } else {
      const bh = 1.27 * w;
      parts.push(rect(cx - w / 2, top, w, bh, `fill="#fff" stroke="#000" stroke-width="${n(sw)}" rx="${n(w * 0.12)}"`));
      parts.push(rect(cx - w * 0.28, top + bh * 0.24, w * 0.56, bh * 0.26, `fill="none" stroke="#000" stroke-width="${n(sw * 0.8)}" rx="${n(w * 0.03)}"`));
      parts.push(text(cx, top + bh * 0.37, w * 0.12, "A", bold()));
      parts.push(text(cx, top + bh * 0.72, w * 0.1, "C", bold()));
    }
    if (numbers) parts.push(text(cx, top + 1.27 * w + (labelU * w) / 2 + 0.5, clamp(w * 0.2, 2.6, 7), String(i + 1), bold()));
  }
  return { body: parts.join("\n"), note };
}

// ---------------------------------------------------------------------------
// Reihenfolge mit Muster-Code
// ---------------------------------------------------------------------------

type Fill = "solid" | "stripes" | "dots" | "cross" | "white";
const FILLS: Fill[] = ["solid", "stripes", "dots", "cross", "white"];
const FILL_LABEL: Record<Fill, string> = { solid: "Voll", stripes: "Streifen", dots: "Punkte", cross: "Gitter", white: "Leer" };
const LETTERS = "ABCDEFGHIJKL".split("");

function fillAttr(g: G, f: Fill) {
  if (f === "solid") return "#000";
  if (f === "white") return "#fff";
  return `url(#${g.uid}-${f === "stripes" ? "s" : f === "dots" ? "d" : "x"})`;
}

/** Fläche mit Muster: weisser Grund, Muster, Umriss. */
function patterned(g: G, el: (attrs: string) => string, f: Fill, sw: number) {
  return [el('fill="#fff"'), f !== "white" ? el(`fill="${fillAttr(g, f)}"`) : "", el(`fill="none" stroke="#000" stroke-width="${n(sw)}" stroke-linejoin="round"`)].filter(Boolean).join("\n");
}

/** Weisser Buchstaben-Chip (lesbar auf jedem Muster). */
function chip(cx: number, cy: number, r: number, label: string) {
  return [circle(cx, cy, r, `fill="#fff" stroke="#000" stroke-width="${n(clamp(r * 0.08, 0.25, 0.6))}"`), text(cx, cy, r * 1.25, label, bold())].join("\n");
}

function sequence(c: Ctx, subject: string): Body {
  const { p } = c;
  const count = int(p.count, 5, 3, 8);
  const seed = int(p.seed, 1, 0, 9999);
  const numbers = p.numbers ?? true;
  const { g, area, parts } = sheet(c, subject, [ZONES_LINE, "Reihenfolge nach Nummer, Buchstabe oder Muster ansagen (Voll, Streifen, Punkte, Gitter, Leer)."]);
  const seq = shuffle(range(1, count), seed);
  const fills = [...shuffle(FILLS, seed + 3), ...shuffle(FILLS, seed + 4)];
  const B = 1.2;
  const tagU = 0.32;
  const numU = numbers ? 0.3 : 0;
  const grid = fitGrid(count, area, 1.12, tagU + B + numU + 0.12);
  const k = grid.k;
  for (let i = 0; i < count; i++) {
    const col = i % grid.cols;
    const row = Math.floor(i / grid.cols);
    const blockH = (tagU + B + numU) * k;
    const x = area.x + grid.cellW * (col + 0.5) - k / 2;
    const top = area.y + grid.cellH * (row + 0.5) - blockH / 2;
    const f = fills[i];
    // Code-Schild über dem Kopf: Muster + Buchstabe
    const tw = 0.62 * k;
    const th = 0.24 * k;
    const tx = x + 0.5 * k - tw / 2;
    parts.push(patterned(g, (a) => rect(tx, top, tw, th, `${a} rx="${n(th * 0.2)}"`), f, clamp(k * 0.012, 0.3, 0.8)));
    parts.push(chip(x + 0.5 * k, top + th / 2, th * 0.38, LETTERS[i]));
    const fy = top + tagU * k;
    parts.push(figure(g, x, fy, k, { style: "target", zones: true, bottom: B }));
    if (numbers) parts.push(tag(x + 0.5 * k - (numU * k * 0.85) / 2, fy + B * k + numU * k * 0.08, numU * k * 0.85, String(seq[i])));
  }
  const key = range(0, count - 1).map((i) => `${LETTERS[i]}=${FILL_LABEL[fills[i]]}`).join(" ");
  return { body: parts.join("\n"), note: `Reihenfolge · Anordnung ${seed} · ${key}` };
}

type ShapeKind = "circle" | "square" | "triangle" | "diamond" | "hexagon";
const SHAPES: ShapeKind[] = ["circle", "square", "triangle", "diamond", "hexagon"];

function shapeEl(kind: ShapeKind, cx: number, cy: number, s: number): (attrs: string) => string {
  const h = s / 2;
  if (kind === "circle") return (a) => circle(cx, cy, h, a);
  if (kind === "square") return (a) => rect(cx - h * 0.88, cy - h * 0.88, s * 0.88, s * 0.88, a);
  const pts = (list: [number, number][]) => list.map(([u, v]) => `${n(cx + u * h)},${n(cy + v * h)}`).join(" ");
  if (kind === "triangle") return (a) => `<polygon points="${pts([[0, -1], [0.95, 0.72], [-0.95, 0.72]])}" ${a}/>`;
  if (kind === "diamond") return (a) => `<polygon points="${pts([[0, -1], [0.85, 0], [0, 1], [-0.85, 0]])}" ${a}/>`;
  const hex = range(0, 5).map((i) => {
    const ang = (Math.PI / 3) * i;
    return [Math.cos(ang), Math.sin(ang) * 0.95] as [number, number];
  });
  return (a) => `<polygon points="${pts(hex)}" ${a}/>`;
}

function codedShapes(c: Ctx, subject: string): Body {
  const { p } = c;
  const count = int(p.count, 9, 4, 12);
  const seed = int(p.seed, 1, 0, 9999);
  const numbers = p.numbers ?? true;
  const { g, area, parts } = sheet(c, subject, ["Ansage nach Form, Muster (Voll, Streifen, Punkte, Gitter, Leer), Buchstabe oder Nummer – z.B. «Dreieck Streifen» oder «C, dann 4».", "Gewertet wird nur ein Treffer im angesagten Ziel."]);
  const kinds = shuffle(range(0, count - 1).map((i) => SHAPES[i % SHAPES.length]), seed);
  const fills = shuffle(range(0, count - 1).map((i) => FILLS[(i + Math.floor(i / SHAPES.length)) % FILLS.length]), seed + 5);
  const nums = shuffle(range(1, count), seed + 9);
  const numU = numbers ? 0.28 : 0;
  const grid = fitGrid(count, area, 1.15, 1 + numU + 0.15);
  const s = grid.k;
  const sw = clamp(s * 0.025, 0.5, 1.2);
  for (let i = 0; i < count; i++) {
    const col = i % grid.cols;
    const row = Math.floor(i / grid.cols);
    const cx = area.x + grid.cellW * (col + 0.5);
    const cy = area.y + grid.cellH * (row + 0.5) - (numU * s) / 2;
    const kind = kinds[i];
    parts.push(patterned(g, shapeEl(kind, cx, cy, s), fills[i], sw));
    parts.push(chip(cx, kind === "triangle" ? cy + s * 0.12 : cy, s * 0.13, LETTERS[i]));
    if (numbers) parts.push(text(cx, cy + s / 2 + (numU * s) / 2 + 0.4, clamp(s * 0.17, 2.6, 7), String(nums[i]), bold()));
  }
  return { body: parts.join("\n"), note: `Formen mit Muster-Code · Anordnung ${seed}` };
}

// ---------------------------------------------------------------------------
// Bewegung, Drehung, Low-Light
// ---------------------------------------------------------------------------

function mover(c: Ctx, subject: string): Body {
  const { p } = c;
  const count = int(p.count, 3, 2, 5);
  const lanes = int(p.rows, 2, 1, 3);
  const dir: 1 | -1 = p.variant === "left" ? -1 : 1;
  const { g, area, parts } = sheet(c, subject, [ZONES_LINE, "Ist = aktuelle Position (durchgezogen). +1, +2 … = Vorhalte-Positionen (gestrichelt) in Bewegungsrichtung."]);
  const B = 1.3;
  const labU = 0.22;
  const arrowU = 0.2;
  const laneW = count + 0.1;
  const laneH = B + labU + arrowU + 0.15;
  const k = Math.min(area.w / laneW, area.h / lanes / laneH);
  const laneHmm = area.h / lanes;
  for (let l = 0; l < lanes; l++) {
    const ox = area.x + (area.w - count * k) / 2;
    const oy = area.y + laneHmm * l + (laneHmm - laneH * k) / 2 + 0.05 * k;
    if (l > 0) parts.push(line(area.x, area.y + laneHmm * l, area.x + area.w, area.y + laneHmm * l, 0.2, "#999", 'stroke-dasharray="1 1"'));
    for (let i = 0; i < count; i++) {
      // i = 0 ist die Ist-Position; die weiteren folgen in Bewegungsrichtung
      const slot = dir > 0 ? i : count - 1 - i;
      const x = ox + slot * k;
      parts.push(figure(g, x, oy, k, { style: i === 0 ? "target" : "ghost", zones: true, bottom: B }));
      const lab = i === 0 ? "Ist" : `+${i}`;
      const ly = oy + B * k + (labU * k) / 2 + 0.3;
      parts.push(text(x + 0.5 * k, ly, clamp(k * 0.11, 2.4, 6), lab, bold(i === 0 ? "#000" : "#555")));
    }
    const ay = oy + (B + labU + arrowU / 2) * k;
    const x0 = ox + 0.15 * k;
    const x1 = ox + (count - 0.15) * k;
    const sw = clamp(k * 0.015, 0.4, 1);
    const ah = clamp(k * 0.06, 1.5, 4);
    parts.push(line(x0, ay, x1, ay, sw));
    const tip = dir > 0 ? x1 : x0;
    parts.push(`<polygon points="${n(tip)},${n(ay)} ${n(tip - dir * ah * 1.6)},${n(ay - ah)} ${n(tip - dir * ah * 1.6)},${n(ay + ah)}" fill="#000"/>`);
    parts.push(tag(area.x + 1, oy, clamp(k * 0.12, 3.5, 8), String(l + 1)));
  }
  return { body: parts.join("\n"), note: `Bewegung simuliert · ${dir > 0 ? "nach rechts" : "nach links"} · ${count} Positionen` };
}

function turned(c: Ctx, subject: string): Body {
  const { p } = c;
  const count = int(p.count, 2, 1, 3);
  const variant = p.variant === "profile" || p.variant === "half" ? p.variant : "mixed";
  const numbers = p.numbers ?? true;
  const { g, area, parts } = sheet(c, subject, [ZONES_LINE, "Gedrehte Figur: die Trefferzone A ist schmal. Nur Treffer innerhalb der Zonen werten."]);
  const grid = fitGrid(count, area, 1.1, 1.6);
  const sc = distanceScale(c, grid.k * 0.98, FIGURE_UNIT_MM);
  const k = sc.k;
  for (let i = 0; i < count; i++) {
    const col = i % grid.cols;
    const row = Math.floor(i / grid.cols);
    const kind = variant === "mixed" ? (i % 2 === 0 ? "profile" : "half") : variant;
    const sx = kind === "profile" ? 0.45 : 0.72;
    const facing: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const x = area.x + grid.cellW * (col + 0.5) - k / 2;
    const y = area.y + grid.cellH * (row + 0.5) - (1.5 * k) / 2;
    parts.push(figure(g, x, y, k, { style: "target", zones: true, sx, facing, arm: true }));
    if (numbers) parts.push(tag(area.x + grid.cellW * col + 1, area.y + grid.cellH * row + 1, clamp(k * 0.12, 4, 9), String(i + 1)));
  }
  const label = variant === "profile" ? "Profil 90°" : variant === "half" ? "halb gedreht 45°" : "Profil und halb gedreht";
  return { body: parts.join("\n"), note: joinNote(`Verdrehte Figur · ${label}`, sc.note) };
}

function lowLight(c: Ctx, subject: string): Body {
  const { p } = c;
  const dark = p.variant !== "minimal";
  const count = int(p.count, 3, 1, 6);
  const numbers = p.numbers ?? true;
  const { g, area, parts } = sheet(
    c,
    subject,
    [ZONES_LINE, dark ? "Low-Light: dünne weisse Umrisse auf Schwarz. Achtung: braucht viel Toner." : "Minimal: feine graue Linien, wenig Kontrast und kaum Tinte."],
    dark,
  );
  const grid = fitGrid(count, area, 1.12, 1.62);
  const k = grid.k;
  for (let i = 0; i < count; i++) {
    const col = i % grid.cols;
    const row = Math.floor(i / grid.cols);
    const x = area.x + grid.cellW * (col + 0.5) - k / 2;
    const y = area.y + grid.cellH * (row + 0.5) - (1.5 * k) / 2;
    parts.push(figure(g, x, y, k, { style: dark ? "dark" : "minimal", zones: true }));
    if (numbers) {
      const s = clamp(k * 0.12, 4, 9);
      if (dark) parts.push(tag(area.x + grid.cellW * col + 1.5, area.y + grid.cellH * row + 1.5, s, String(i + 1), true));
      else parts.push(text(area.x + grid.cellW * col + 1 + s / 2, area.y + grid.cellH * row + 1 + s / 2, s * 0.7, String(i + 1), bold("#999")));
    }
  }
  return { body: parts.join("\n"), note: dark ? "Low-Light · viel Toner – sparsam drucken" : "Kontrast minimal · wenig Tinte" };
}
