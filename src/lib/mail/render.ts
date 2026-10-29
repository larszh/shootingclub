/**
 * Mail-Layout: tabellenbasiert mit Inline-CSS (Outlook, Gmail, Apple Mail).
 * Rein funktional, alle Eingaben werden escaped. Liefert HTML und Klartext.
 */

export type RenderMailInput = {
  locale?: string;
  title: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  footer?: string;
  tenantName?: string;
  /** Hex-Farbe für Button und Akzentlinie, z.B. #d6232d */
  accent?: string;
};

const DEFAULT_ACCENT = "#d6232d";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Nur http(s)-Links zulassen, sonst Platzhalter (verhindert javascript:-URLs). */
export function safeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "#";
  } catch {
    return "#";
  }
}

function safeColor(c: string | undefined): string {
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : DEFAULT_ACCENT;
}

/** Schwarz oder weiss als Textfarbe auf dem Akzent (einfache Luminanz). */
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#111110" : "#ffffff";
}

const FALLBACK_HINT: Record<string, string> = {
  de: "Falls der Button nicht funktioniert, diesen Link im Browser öffnen:",
  fr: "Si le bouton ne fonctionne pas, ouvrez ce lien dans votre navigateur :",
  it: "Se il pulsante non funziona, apri questo link nel browser:",
};

/** Absätze behalten Zeilenumbrüche (\n → <br>). */
function paragraphHtml(p: string) {
  return escapeHtml(p).replace(/\r?\n/g, "<br>");
}

export function renderMail(o: RenderMailInput): { html: string; text: string } {
  const locale = o.locale === "fr" || o.locale === "it" ? o.locale : "de";
  const accent = safeColor(o.accent);
  const onAccent = textOn(accent);
  const brand = o.tenantName ? `${o.tenantName}` : "Standchef";
  const button = o.button ? { label: o.button.label, url: safeUrl(o.button.url) } : null;

  const paras = o.paragraphs
    .map((p) => `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#2b2a28;">${paragraphHtml(p)}</p>`)
    .join("\n");

  const buttonHtml = button
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0 8px 0;"><tr><td style="border-radius:10px;background:${accent};">
<a href="${escapeHtml(button.url)}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:${onAccent};text-decoration:none;border-radius:10px;">${escapeHtml(button.label)}</a>
</td></tr></table>
<p style="margin:14px 0 0 0;font-size:12px;line-height:1.5;color:#8a8884;">${escapeHtml(FALLBACK_HINT[locale])}<br><a href="${escapeHtml(button.url)}" style="color:#5c5a56;word-break:break-all;">${escapeHtml(button.url)}</a></p>`
    : "";

  const footer = o.footer ? escapeHtml(o.footer).replace(/\r?\n/g, "<br>") : "Standchef · standchef.ch";

  const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(o.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f2ee;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e3dd;border-radius:14px;">
<tr><td style="height:4px;background:${accent};border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:22px 26px 6px 26px;font-size:13px;font-weight:600;color:#8a8884;letter-spacing:.02em;">${escapeHtml(brand)}</td></tr>
<tr><td style="padding:0 26px 26px 26px;">
<h1 style="margin:6px 0 16px 0;font-size:21px;line-height:1.3;color:#111110;font-weight:700;">${escapeHtml(o.title)}</h1>
${paras}
${buttonHtml}
</td></tr>
</table>
<p style="margin:14px 0 0 0;font-size:12px;line-height:1.5;color:#8a8884;max-width:560px;">${footer}</p>
</td></tr></table>
</body></html>`;

  const textParts = [o.title, "", ...o.paragraphs.flatMap((p) => [p, ""])];
  if (button) textParts.push(`${button.label}: ${button.url}`, "");
  textParts.push("--", o.footer ?? "Standchef · standchef.ch");
  return { html, text: textParts.join("\n") };
}

/** Entfernt CR/LF und Steuerzeichen aus Header-Werten (Header-Injection). */
export function cleanHeader(v: string, max = 191): string {
  return v.replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);
}

/** Exponentielles Backoff in Minuten: 1, 2, 4, 8 … */
export function retryDelayMs(attempts: number): number {
  return 2 ** Math.max(0, attempts) * 60_000;
}
