/**
 * Schlanker, fehlertoleranter Leser für ISO-20022-Bankmeldungen (camt.052 / camt.053 / camt.054).
 *
 * Bewusst ohne Abhängigkeiten: ein kleiner XML-Tokenizer baut einen Baum mit lokalen Namen
 * (Namespace-Präfixe werden entfernt). DOCTYPE und eigene Entities werden ignoriert und nie
 * aufgelöst (kein XXE, keine «Billion Laughs»).
 */

export type XNode = { name: string; attrs: Record<string, string>; children: XNode[]; text: string };

const NAMED_ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decodeEntities(s: string) {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, ent: string) => {
    if (ent[0] === "#") {
      const code = ent[1] === "x" || ent[1] === "X" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    }
    return NAMED_ENTITIES[ent] ?? m;
  });
}

function localName(qname: string) {
  const i = qname.indexOf(":");
  return i >= 0 ? qname.slice(i + 1) : qname;
}

function parseAttrs(raw: string) {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) attrs[localName(m[1]!)] = decodeEntities(m[3] ?? m[4] ?? "");
  return attrs;
}

/**
 * Obergrenzen gegen präparierte Dateien: camt-Meldungen sind kaum mehr als 15 Ebenen tief. Mit
 * begrenzter Tiefe bleibt die Suche nach dem passenden offenen Element beim End-Tag konstant,
 * der Parser läuft also linear statt quadratisch.
 */
const MAX_DEPTH = 64;
const MAX_NODES = 500_000;

/** Parst XML zu einem Baum. Wirft bei völlig unlesbarer Eingabe, toleriert aber fehlende End-Tags. */
export function parseXml(xml: string): XNode {
  const root: XNode = { name: "#root", attrs: {}, children: [], text: "" };
  const stack: XNode[] = [root];
  let i = 0;
  let nodes = 0;
  const n = xml.length;
  // BOM entfernen
  if (xml.charCodeAt(0) === 0xfeff) i = 1;
  while (i < n) {
    const lt = xml.indexOf("<", i);
    if (lt < 0) {
      stack[stack.length - 1]!.text += decodeEntities(xml.slice(i));
      break;
    }
    if (lt > i) stack[stack.length - 1]!.text += decodeEntities(xml.slice(i, lt));
    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt + 4);
      i = end < 0 ? n : end + 3;
    } else if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt + 9);
      stack[stack.length - 1]!.text += xml.slice(lt + 9, end < 0 ? n : end);
      i = end < 0 ? n : end + 3;
    } else if (xml.startsWith("<?", lt)) {
      const end = xml.indexOf("?>", lt + 2);
      i = end < 0 ? n : end + 2;
    } else if (xml.startsWith("<!", lt)) {
      // DOCTYPE o.ä.: inkl. internem Subset überspringen, Entities nicht auswerten
      let depth = 0;
      let j = lt + 2;
      for (; j < n; j++) {
        const c = xml[j];
        if (c === "[") depth++;
        else if (c === "]") depth--;
        else if (c === ">" && depth <= 0) break;
      }
      i = j + 1;
    } else if (xml[lt + 1] === "/") {
      const end = xml.indexOf(">", lt);
      const name = localName(xml.slice(lt + 2, end < 0 ? n : end).trim());
      // Tolerant: bis zum passenden offenen Element schliessen
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k]!.name === name) {
          stack.length = k;
          break;
        }
      }
      i = end < 0 ? n : end + 1;
    } else {
      // Start-Tag; Anführungszeichen in Attributen beachten
      let j = lt + 1;
      let quote: string | null = null;
      for (; j < n; j++) {
        const c = xml[j];
        if (quote) {
          if (c === quote) quote = null;
        } else if (c === '"' || c === "'") quote = c;
        else if (c === ">") break;
      }
      const inner = xml.slice(lt + 1, j);
      const selfClosing = inner.endsWith("/");
      const body = selfClosing ? inner.slice(0, -1) : inner;
      const sp = body.search(/\s/);
      const qname = sp < 0 ? body : body.slice(0, sp);
      if (!qname) throw new Error("Ungültiges XML");
      const node: XNode = { name: localName(qname), attrs: sp < 0 ? {} : parseAttrs(body.slice(sp)), children: [], text: "" };
      if (++nodes > MAX_NODES) throw new Error("XML enthält zu viele Elemente");
      stack[stack.length - 1]!.children.push(node);
      if (!selfClosing) {
        if (stack.length > MAX_DEPTH) throw new Error("XML ist zu tief verschachtelt");
        stack.push(node);
      }
      i = j + 1;
    }
  }
  return root;
}

/** Erstes Kind entlang eines Pfads (lokale Namen). */
export function child(node: XNode | null | undefined, ...path: string[]): XNode | null {
  let cur: XNode | null | undefined = node;
  for (const p of path) {
    cur = cur?.children.find((c) => c.name === p);
    if (!cur) return null;
  }
  return cur ?? null;
}

/** Alle direkten Kinder mit Namen. */
export function childrenNamed(node: XNode | null | undefined, name: string) {
  return node ? node.children.filter((c) => c.name === name) : [];
}

/** Alle Nachfahren mit Namen (Tiefensuche, ohne in Treffer hinabzusteigen). */
export function findAll(node: XNode | null | undefined, name: string): XNode[] {
  const out: XNode[] = [];
  const walk = (n: XNode) => {
    for (const c of n.children) {
      if (c.name === name) out.push(c);
      else walk(c);
    }
  };
  if (node) walk(node);
  return out;
}

export function textOf(node: XNode | null | undefined) {
  return (node?.text ?? "").replace(/\s+/g, " ").trim();
}

function textAt(node: XNode | null | undefined, ...path: string[]) {
  return textOf(child(node, ...path));
}

// ---------------------------------------------------------------------------
// camt-Auswertung
// ---------------------------------------------------------------------------

export type CamtCredit = {
  /** stabile Kennung innerhalb der Datei (für Auswahl in der Vorschau) */
  key: string;
  amountCents: number;
  currency: string;
  /** Buchungsdatum YYYY-MM-DD */
  bookingDate: string;
  /** strukturierte Referenz (QRR oder SCOR), ohne Leerzeichen */
  reference: string | null;
  /** unstrukturierte Mitteilung(en) */
  message: string;
  debtorName: string | null;
  bankRef: string | null;
};

export type CamtParseResult = {
  kind: "camt.052" | "camt.053" | "camt.054" | "unbekannt";
  credits: CamtCredit[];
  skippedDebits: number;
  skippedOther: number;
  iban: string | null;
};

/** "1'234.50" / "50" / "50.5" → Rappen. Ohne Fliesskomma-Rundungsfehler. */
export function amountToCents(raw: string) {
  const s = raw.replace(/['\s]/g, "").replace(",", ".");
  const m = s.match(/^(-?)(\d+)(?:\.(\d{1,}))?$/);
  if (!m) return null;
  const frac = (m[3] ?? "").padEnd(2, "0");
  const cents = Number(m[2]) * 100 + Number(frac.slice(0, 2)) + (Number(frac[2] ?? "0") >= 5 ? 1 : 0);
  return m[1] ? -cents : cents;
}

function dateOf(node: XNode | null) {
  const v = textAt(node, "Dt") || textAt(node, "DtTm") || textOf(node);
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : null;
}

function statusOf(ntry: XNode) {
  const sts = child(ntry, "Sts");
  return (textAt(sts, "Cd") || textOf(sts)).toUpperCase();
}

function debtorOf(tx: XNode) {
  const p = child(tx, "RltdPties");
  const name = textAt(p, "Dbtr", "Nm") || textAt(p, "Dbtr", "Pty", "Nm") || textAt(p, "UltmtDbtr", "Nm") || textAt(p, "UltmtDbtr", "Pty", "Nm");
  return name ? name.slice(0, 140) : null;
}

/** ISO-Währungscode (3 Buchstaben), sonst Ersatzwert. */
function currencyOf(node: XNode | null | undefined, fallback: string) {
  const c = (node?.attrs.Ccy ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : fallback;
}

function referenceOf(tx: XNode | null) {
  for (const strd of findAll(child(tx, "RmtInf"), "Strd")) {
    const ref = textAt(strd, "CdtrRefInf", "Ref");
    if (ref) return ref.replace(/\s+/g, "").toUpperCase().slice(0, 35);
  }
  return null;
}

function messageOf(...nodes: Array<XNode | null>) {
  const parts: string[] = [];
  for (const n of nodes) {
    if (!n) continue;
    for (const u of findAll(child(n, "RmtInf"), "Ustrd")) parts.push(textOf(u));
    for (const s of findAll(child(n, "RmtInf"), "Strd")) {
      const add = findAll(s, "AddtlRmtInf").map(textOf);
      parts.push(...add);
    }
    const addtl = textAt(n, "AddtlTxInf") || textAt(n, "AddtlNtryInf");
    if (addtl) parts.push(addtl);
  }
  return [...new Set(parts.filter(Boolean))].join(" · ").slice(0, 500);
}

/** Liest Gutschriften aus camt.052/053/054. Wirft bei unlesbarer Datei eine verständliche Meldung. */
export function parseCamt(xml: string): CamtParseResult {
  let root: XNode;
  try {
    root = parseXml(xml);
  } catch {
    throw new Error("Die Datei ist kein lesbares XML.");
  }
  const doc = child(root, "Document") ?? root;
  const kind: CamtParseResult["kind"] = child(doc, "BkToCstmrDbtCdtNtfctn") ? "camt.054" : child(doc, "BkToCstmrStmt") ? "camt.053" : child(doc, "BkToCstmrAcctRpt") ? "camt.052" : "unbekannt";
  const entries = findAll(doc, "Ntry");
  if (kind === "unbekannt" && entries.length === 0) throw new Error("Keine camt-Datei erkannt (erwartet camt.053 oder camt.054).");
  const ibanNode = findAll(doc, "Acct")[0];
  const iban = textAt(ibanNode, "Id", "IBAN") || null;

  const credits: CamtCredit[] = [];
  let skippedDebits = 0;
  let skippedOther = 0;
  entries.forEach((ntry, ei) => {
    const cdi = textAt(ntry, "CdtDbtInd").toUpperCase();
    if (cdi === "DBIT") {
      skippedDebits++;
      return;
    }
    if (textAt(ntry, "RvslInd").toLowerCase() === "true") {
      skippedOther++;
      return;
    }
    const st = statusOf(ntry);
    if (st && st !== "BOOK") {
      skippedOther++;
      return;
    }
    const entryAmtNode = child(ntry, "Amt");
    const entryAmt = amountToCents(textOf(entryAmtNode));
    const entryCcy = currencyOf(entryAmtNode, "CHF");
    const bookingDate = dateOf(child(ntry, "BookgDt")) ?? dateOf(child(ntry, "ValDt"));
    const entryRef = textAt(ntry, "AcctSvcrRef") || null;
    const txs = childrenNamed(child(ntry, "NtryDtls"), "TxDtls").length
      ? childrenNamed(child(ntry, "NtryDtls"), "TxDtls")
      : findAll(child(ntry, "NtryDtls"), "TxDtls");

    if (!bookingDate) {
      skippedOther++;
      return;
    }
    if (txs.length === 0) {
      if (entryAmt === null || entryAmt <= 0) {
        skippedOther++;
        return;
      }
      credits.push({ key: `${ei}`, amountCents: entryAmt, currency: entryCcy, bookingDate, reference: null, message: messageOf(ntry), debtorName: null, bankRef: entryRef });
      return;
    }
    txs.forEach((tx, ti) => {
      const txCdi = textAt(tx, "CdtDbtInd").toUpperCase();
      if (txCdi === "DBIT") {
        skippedDebits++;
        return;
      }
      const amtNode = child(tx, "Amt") ?? child(tx, "AmtDtls", "TxAmt", "Amt") ?? child(tx, "AmtDtls", "InstdAmt", "Amt") ?? (txs.length === 1 ? entryAmtNode : null);
      const amount = amtNode ? amountToCents(textOf(amtNode)) : null;
      if (amount === null || amount <= 0) {
        skippedOther++;
        return;
      }
      credits.push({
        key: `${ei}.${ti}`,
        amountCents: amount,
        currency: currencyOf(amtNode, entryCcy),
        bookingDate,
        reference: referenceOf(tx),
        message: messageOf(tx, txs.length === 1 ? ntry : null),
        debtorName: debtorOf(tx),
        bankRef: textAt(tx, "Refs", "AcctSvcrRef") || textAt(tx, "Refs", "EndToEndId") || entryRef,
      });
    });
  });
  return { kind, credits, skippedDebits, skippedOther, iban };
}
