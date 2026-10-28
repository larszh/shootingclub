import { PAPER_MM, PAPER_SIZES, PRINT_LAYOUTS, type PaperSize, type PrintLayoutKey } from "./types";

/** Ein Stück (Scheibe) auf dem Druckbogen, Masse in mm. */
export type PrintPiece = { x: number; y: number; size: PaperSize };
export type PrintSheetLayout = {
  /** Bogenformat für @page */
  sheet: PaperSize;
  orientation: "portrait" | "landscape";
  w: number;
  h: number;
  pieces: PrintPiece[];
  /** Schnittlinien (gestrichelt) */
  cuts: { x1: number; y1: number; x2: number; y2: number }[];
};

export const MAX_COPIES = 20;

/** Rein rechnerisch, damit Server und Browser identisch layouten. */
export function printLayout(layout: PrintLayoutKey, paper: PaperSize): PrintSheetLayout {
  if (layout === "2xA5") {
    const { w: pw, h: ph } = PAPER_MM.A5; // 148 × 210
    const W = PAPER_MM.A4.h; // 297
    const H = PAPER_MM.A4.w; // 210
    const half = W / 2;
    return {
      sheet: "A4",
      orientation: "landscape",
      w: W,
      h: H,
      pieces: [0, 1].map((i) => ({ x: i * half + (half - pw) / 2, y: (H - ph) / 2, size: "A5" as const })),
      cuts: [{ x1: half, y1: 0, x2: half, y2: H }],
    };
  }
  if (layout === "4xA6") {
    const { w: pw, h: ph } = PAPER_MM.A6; // 105 × 148
    const W = PAPER_MM.A4.w; // 210
    const H = PAPER_MM.A4.h; // 297
    const cw = W / 2;
    const ch = H / 2;
    const pieces: PrintPiece[] = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) pieces.push({ x: c * cw + (cw - pw) / 2, y: r * ch + (ch - ph) / 2, size: "A6" });
    return {
      sheet: "A4",
      orientation: "portrait",
      w: W,
      h: H,
      pieces,
      cuts: [
        { x1: cw, y1: 0, x2: cw, y2: H },
        { x1: 0, y1: ch, x2: W, y2: ch },
      ],
    };
  }
  const { w, h } = PAPER_MM[paper];
  return { sheet: paper, orientation: "portrait", w, h, pieces: [{ x: 0, y: 0, size: paper }], cuts: [] };
}

/** Welche Layouts für eine Vorlage möglich sind. PDFs nur einzeln. */
export function allowedLayouts(paperSizes: PaperSize[], isPdf: boolean): PrintLayoutKey[] {
  const out: PrintLayoutKey[] = ["single"];
  if (isPdf) return out;
  if (paperSizes.includes("A5")) out.push("2xA5");
  if (paperSizes.includes("A6")) out.push("4xA6");
  return out;
}

export function normalizePrintOptions(
  raw: { size?: string; layout?: string; copies?: string },
  paperSizes: PaperSize[],
  isPdf: boolean,
): { paper: PaperSize; layout: PrintLayoutKey; copies: number } {
  const sizes = paperSizes.length ? paperSizes : (["A4"] as PaperSize[]);
  const paper = (PAPER_SIZES as readonly string[]).includes(raw.size ?? "") && sizes.includes(raw.size as PaperSize) ? (raw.size as PaperSize) : sizes[0];
  const allowed = allowedLayouts(sizes, isPdf);
  const layout = PRINT_LAYOUTS.some((l) => l.key === raw.layout) && allowed.includes(raw.layout as PrintLayoutKey) ? (raw.layout as PrintLayoutKey) : "single";
  const n = Math.round(Number(raw.copies ?? 1));
  const copies = Number.isFinite(n) ? Math.min(MAX_COPIES, Math.max(1, n)) : 1;
  return { paper, layout, copies };
}
