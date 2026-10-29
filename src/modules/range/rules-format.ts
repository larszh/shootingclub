/**
 * «Markdown light» für die Standordnung: Überschriften (# / ##), Listen (- / * / 1.),
 * Absätze und **fett**. Bewusst ohne HTML, damit nichts eingeschleust werden kann.
 */

export type Inline = { text: string; bold: boolean };
export type RulesBlock =
  | { type: "h1" | "h2" | "p"; parts: Inline[] }
  | { type: "ul" | "ol"; items: Inline[][] };

/** **fett** in Textteile zerlegen. Ungeschlossene Sterne bleiben stehen. */
export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), bold: false });
    out.push({ text: m[1]!, bold: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), bold: false });
  return out.length ? out : [{ text: "", bold: false }];
}

export function parseRules(body: string): RulesBlock[] {
  const blocks: RulesBlock[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: Inline[][] } | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", parts: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ type: h[1]!.length === 1 ? "h1" : "h2", parts: parseInline(h[2]!) });
      continue;
    }
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push(parseInline((ul ?? ol)![1]!));
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

/** Erste Zeilen als Kurztext (ohne Markup), z.B. für Vorschauen. */
export function rulesExcerpt(body: string, max = 160) {
  const text = body.replace(/[#*•]/g, "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}
