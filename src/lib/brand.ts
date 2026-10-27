/**
 * Farb-Mathematik für Vereinsfarben (CI/CD). Rein funktional, läuft auf Server und Client.
 *
 * - Hex-Validierung und Normalisierung
 * - relative Luminanz und WCAG-Kontrast
 * - beste Textfarbe (schwarz/weiss) auf der Akzentfarbe
 * - weiche Tönung (accent-soft) für hell und dunkel
 * - CSS-Variablen-Overrides für hell und dunkel
 */

export const DEFAULT_ACCENT = "#d6232d";
export const DEFAULT_ACCENT_DARK = "#ef3b45";

/** Hintergründe aus globals.css – für Kontrast-Anpassung und Mischungen. */
const LIGHT_SURFACE = "#ffffff";
const DARK_SURFACE = "#1b1b1a";
const DARK_BG = "#111110";

export type BrandPreset = { name: string; hex: string };

/** Typische Farben von Schweizer Schützenvereinen. */
export const BRAND_PRESETS: BrandPreset[] = [
  { name: "Rot", hex: "#d6232d" },
  { name: "Dunkelrot", hex: "#8f1d21" },
  { name: "Blau", hex: "#1d64c8" },
  { name: "Dunkelblau", hex: "#1b2f5e" },
  { name: "Grün", hex: "#2a8a3e" },
  { name: "Tannengrün", hex: "#1f4d33" },
  { name: "Schwarz", hex: "#1c1c1c" },
  { name: "Gold", hex: "#c99a2e" },
  { name: "Orange", hex: "#e8731c" },
  { name: "Violett", hex: "#6b3fa0" },
  { name: "Petrol", hex: "#0f6b73" },
  { name: "Grau", hex: "#5d646c" },
];

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Liefert «#rrggbb» in Kleinbuchstaben oder null, wenn ungültig. */
export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = HEX_RE.exec(input.trim());
  if (!m) return null;
  let h = m[1]!.toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h}`;
}

export function isHexColor(input: string | null | undefined): boolean {
  return normalizeHex(input) !== null;
}

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  const h = normalizeHex(hex) ?? DEFAULT_ACCENT;
  return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Relative Luminanz nach WCAG 2.x (0 = schwarz, 1 = weiss). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG-Kontrastverhältnis zwischen 1 und 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Schwarz oder Weiss – je nachdem, was auf `bg` besser lesbar ist. */
export function bestTextColor(bg: string): "#000000" | "#ffffff" {
  return contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#000000") ? "#ffffff" : "#000000";
}

/** Lineare Mischung: t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

/** Weiche Tönung für Hintergründe (Badges, Hinweise). */
export function softTint(hex: string, mode: "light" | "dark"): string {
  return mode === "light" ? mix(hex, "#ffffff", 0.86) : mix(hex, DARK_BG, 0.76);
}

/**
 * Passt die Akzentfarbe so an, dass sie auf der Fläche mindestens `min` Kontrast hat
 * (Akzent wird auch als Textfarbe genutzt, z.B. in Badges). Im Hellmodus wird abgedunkelt,
 * im Dunkelmodus aufgehellt. Farben, die schon passen, bleiben unverändert.
 */
export function ensureContrast(hex: string, surface: string, min = 3): string {
  const target = relativeLuminance(surface) > 0.5 ? "#000000" : "#ffffff";
  let out = normalizeHex(hex) ?? DEFAULT_ACCENT;
  for (let i = 0; i < 20 && contrastRatio(out, surface) < min; i++) out = mix(out, target, 0.08);
  return out;
}

export type BrandMode = { accent: string; accentInk: string; accentSoft: string; accent2: string; accent2Ink: string };
export type BrandVars = { light: BrandMode; dark: BrandMode };

/** Effektive Farben für hell und dunkel. Ohne gültige Farbe: null (Standard-Design). */
export function brandColors(brandColor: string | null | undefined, brandColor2?: string | null): BrandVars | null {
  const base = normalizeHex(brandColor);
  if (!base) return null;
  const second = normalizeHex(brandColor2) ?? base;

  const lightAccent = ensureContrast(base, LIGHT_SURFACE, 3);
  const darkAccent = ensureContrast(base, DARK_SURFACE, 3.2);
  const light2 = ensureContrast(second, LIGHT_SURFACE, 3);
  const dark2 = ensureContrast(second, DARK_SURFACE, 3.2);

  return {
    light: {
      accent: lightAccent,
      accentInk: bestTextColor(lightAccent),
      accentSoft: softTint(lightAccent, "light"),
      accent2: light2,
      accent2Ink: bestTextColor(light2),
    },
    dark: {
      accent: darkAccent,
      accentInk: bestTextColor(darkAccent),
      accentSoft: softTint(darkAccent, "dark"),
      accent2: dark2,
      accent2Ink: bestTextColor(dark2),
    },
  };
}

function toDecls(m: BrandMode): string {
  return `--accent:${m.accent};--accent-ink:${m.accentInk};--accent-soft:${m.accentSoft};--accent-2:${m.accent2};--accent-2-ink:${m.accent2Ink};`;
}

/**
 * CSS mit Overrides der Akzent-Tokens. Selektoren sind spezifischer als die
 * Basis-Tokens in globals.css (`:root:root`), damit die Reihenfolge egal ist.
 * Hell: Standard. Dunkel: per System (ausser data-theme="light") oder erzwungen.
 */
export function brandCss(brandColor: string | null | undefined, brandColor2?: string | null): string | null {
  const v = brandColors(brandColor, brandColor2);
  if (!v) return null;
  return [
    `:root:root{${toDecls(v.light)}}`,
    `@media (prefers-color-scheme: dark){:root:root:not([data-theme="light"]){${toDecls(v.dark)}}}`,
    `:root:root[data-theme="dark"]{${toDecls(v.dark)}}`,
  ].join("\n");
}

export type ContrastReport = {
  /** Kontrast der gewählten Textfarbe auf der Akzentfarbe (Buttons). */
  textOnAccent: number;
  textColor: "#000000" | "#ffffff";
  /** true, wenn weder schwarz noch weiss 4.5:1 erreicht. */
  lowTextContrast: boolean;
  /** true, wenn die Farbe für hell/dunkel angepasst werden musste. */
  adjustedLight: boolean;
  adjustedDark: boolean;
};

export function contrastReport(hex: string): ContrastReport | null {
  const h = normalizeHex(hex);
  if (!h) return null;
  const textColor = bestTextColor(h);
  const textOnAccent = contrastRatio(h, textColor);
  const v = brandColors(h)!;
  return {
    textOnAccent,
    textColor,
    lowTextContrast: textOnAccent < 4.5,
    adjustedLight: v.light.accent !== h,
    adjustedDark: v.dark.accent !== h,
  };
}

export const DEFAULT_THEME_COLORS = { light: "#f4f2ee", dark: "#111110" } as const;
