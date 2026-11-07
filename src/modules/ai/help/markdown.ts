/**
 * «Markdown light» für Antworten des Assistenten (rein, client-sicher). Unterstützt Absätze,
 * Aufzählungen (- / * / 1.), Zwischentitel (#), **fett**, `code` und Links – aber nur auf
 * interne Pfade der App. Alles andere bleibt Text; es wird nie HTML erzeugt.
 */

export type MdInline = { kind: "text" | "strong" | "code"; text: string } | { kind: "link"; text: string; href: string };

export type MdBlock =
  | { kind: "p"; lines: MdInline[][] }
  | { kind: "h"; parts: MdInline[] }
  | { kind: "ul"; items: MdInline[][] }
  | { kind: "ol"; start: number; items: MdInline[][] };

/** Erlaubte Zeichen in internen Pfaden (keine Leerzeichen, keine Protokolle, keine Backslashes). */
const SAFE_PATH = /^\/(?![/\\])[A-Za-z0-9\-._~/?#=&%+,]*$/;

/**
 * Nur interne Pfade wie «/bookings» oder «/admin/members?tab=x». Absolute URLs, «//host»,
 * «javascript:», Backslashes, Pfad-Tricks («..») und API-Routen werden abgelehnt (null).
 */
export function sanitizeInternalHref(raw: string): string | null {
  const href = raw.trim();
  if (!href || href.length > 200) return null;
  if (!SAFE_PATH.test(href)) return null;
  const path = href.split(/[?#]/)[0]!;
  if (path.split("/").some((seg) => seg === ".." || seg === ".")) return null;
  if (path === "/api" || path.startsWith("/api/")) return null;
  // Prozent-Kodierung, die zu Schrägstrichen/Backslashes/Steuerzeichen dekodiert, ablehnen.
  if (/%(?:2f|5c|0|1|7f)/i.test(path)) return null;
  return href;
}

// [Text](ziel) · **fett** · `code` · nackter Pfad wie /bookings (nach Leerzeichen, Klammer oder Zeilenanfang)
const INLINE = /\[([^\]\n]{1,200})\]\(([^)\s]{1,300})\)|\*\*([^*\n]+?)\*\*|`([^`\n]+)`|(^|[\s(«"'])(\/[a-z][a-z0-9\-/]*[a-z0-9])(?=$|[\s.,;:!?)»"'])/g;

function pushText(out: MdInline[], text: string, kind: "text" | "strong" | "code" = "text") {
  if (!text) return;
  const prev = out.at(-1);
  if (kind === "text" && prev?.kind === "text") prev.text += text;
  else out.push({ kind, text });
}

/** Zerlegt eine Zeile in Teile. Links mit unsicherem Ziel werden zu Text (nur die Beschriftung). */
export function parseMdInline(s: string): MdInline[] {
  const out: MdInline[] = [];
  let last = 0;
  for (const m of s.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > last) pushText(out, s.slice(last, i));
    if (m[1] !== undefined && m[2] !== undefined) {
      const href = sanitizeInternalHref(m[2]);
      if (href) out.push({ kind: "link", text: m[1], href });
      else pushText(out, m[1]);
    } else if (m[3] !== undefined) {
      pushText(out, m[3], "strong");
    } else if (m[4] !== undefined) {
      pushText(out, m[4], "code");
    } else if (m[6] !== undefined) {
      pushText(out, m[5] ?? "");
      const href = sanitizeInternalHref(m[6]);
      if (href) out.push({ kind: "link", text: m[6], href });
      else pushText(out, m[6]);
    }
    last = i + m[0].length;
  }
  if (last < s.length) pushText(out, s.slice(last));
  return out;
}

const UL = /^\s*[-*•]\s+(.*)$/;
const OL = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const H = /^\s*#{1,6}\s+(.*)$/;

/** Ganzer Antworttext → Blöcke. */
export function parseMarkdownLite(text: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const st: { cur: MdBlock | null } = { cur: null };
  const flush = () => {
    if (st.cur) blocks.push(st.cur);
    st.cur = null;
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || /^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      flush();
      continue;
    }
    const h = H.exec(line);
    if (h) {
      flush();
      blocks.push({ kind: "h", parts: parseMdInline(h[1]!) });
      continue;
    }
    const ul = UL.exec(line);
    if (ul) {
      if (st.cur?.kind !== "ul") {
        flush();
        st.cur = { kind: "ul", items: [] };
      }
      st.cur.items.push(parseMdInline(ul[1]!));
      continue;
    }
    const ol = OL.exec(line);
    if (ol) {
      if (st.cur?.kind !== "ol") {
        flush();
        st.cur = { kind: "ol", start: Number(ol[1]) || 1, items: [] };
      }
      st.cur.items.push(parseMdInline(ol[2]!));
      continue;
    }
    // Eingerückte Fortsetzung eines Listenpunkts
    const c = st.cur;
    if (c && (c.kind === "ul" || c.kind === "ol") && /^\s{2,}\S/.test(raw)) {
      const item = c.items.at(-1)!;
      pushText(item, " ");
      item.push(...parseMdInline(line.trim()));
      continue;
    }
    if (st.cur?.kind !== "p") {
      flush();
      st.cur = { kind: "p", lines: [] };
    }
    st.cur.lines.push(parseMdInline(line.trim()));
  }
  flush();
  return blocks;
}
