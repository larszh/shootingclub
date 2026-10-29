/**
 * Kurze, lesbare Gerätebeschreibung aus dem User-Agent, z.B. «Firefox auf Windows» oder
 * «Safari auf iPhone». Nur für die Anzeige der angemeldeten Geräte; null, wenn nichts erkennbar ist.
 */
export function describeUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const os =
    /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Mac OS X|Macintosh/.test(ua) ? "Mac"
    : /Linux/.test(ua) ? "Linux"
    : null;
  const browser =
    /Edg(e|A|iOS)?\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser\//.test(ua) ? "Samsung Internet"
    : /Firefox\/|FxiOS\//.test(ua) ? "Firefox"
    : /Chrome\/|CriOS\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) && /Version\//.test(ua) ? "Safari"
    : null;
  if (browser && os) return `${browser} auf ${os}`;
  return browser ?? os;
}
