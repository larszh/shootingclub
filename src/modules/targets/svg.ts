import { PAPER_MM, type PaperSize, type TargetParams, type TargetSubject } from "./types";

/**
 * Erzeugt ein druckfertiges SVG (schwarz/weiss) in Millimetern.
 * Das SVG füllt das gewählte Papierformat (Hochformat); der Fusszeilentext
 * wird vom Druck-Layout gesetzt, nicht hier.
 */
export function renderTargetSvg(subject: TargetSubject, size: PaperSize, params: TargetParams = {}): string {
  const { w, h } = PAPER_MM[size];
  const margin = 10; // Druckrand
  const inner = { x: margin, y: margin, w: w - 2 * margin, h: h - 2 * margin - 8 }; // 8 mm Platz für Fusszeile
  const body = renderBody(subject, inner, params);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif">
<rect width="${w}" height="${h}" fill="#fff"/>
${body}
</svg>`;
}

type Box = { x: number; y: number; w: number; h: number };

function renderBody(subject: TargetSubject, box: Box, p: TargetParams): string {
  switch (subject) {
    case "RINGS_10":
      return rings(box, p, 10);
    case "RINGS_5":
      return rings(box, p, 5);
    case "DOTS":
      return dots(box, p);
    case "GRID":
      return grid(box, p);
    case "SILHOUETTE":
      return silhouette(box);
    case "DIAMOND":
      return diamonds(box, p);
    default:
      return "";
  }
}

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

function rings(box: Box, p: TargetParams, ringCount: number) {
  const maxD = Math.min(box.w, box.h);
  const d = Math.min(p.diameterMm ?? maxD, maxD);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const blackFrom = p.blackFrom ?? (ringCount === 10 ? 7 : 9);
  return ringTarget(cx, cy, d / 2, ringCount, blackFrom, p.numbers ?? true);
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
