/**
 * Namensabgleich für den Resultat-Import: Schützennamen aus der Datei den Mitgliedern zuordnen.
 * Unscharf, aber vorsichtig: «Nachname Vorname» = «Vorname Nachname», Umlaute (ü = ue = u),
 * Akzente, Bindestriche und Gross/Klein egal, Initialen («H. Müller») und kleine Tippfehler.
 * Automatisch zugeordnet wird nur bei hoher und eindeutiger Übereinstimmung, sonst Vorschlag.
 */

/** Ab dieser Ähnlichkeit wird automatisch zugeordnet (wenn eindeutig). */
export const AUTO_MATCH_SCORE = 0.92;
/** Ab dieser Ähnlichkeit erscheint ein Mitglied als Vorschlag. */
export const SUGGEST_SCORE = 0.6;
/** Abstand zum zweitbesten Treffer, damit die Zuordnung als eindeutig gilt. */
const AMBIGUITY_MARGIN = 0.04;

/** Name vergleichbar machen: klein, Umlaute gefaltet (ä/ae → a …), ohne Akzente, nur a–z/0–9 und Leerzeichen. */
export function foldName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ae/g, "a")
    .replace(/oe/g, "o")
    .replace(/ue/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function nameTokens(s: string): string[] {
  return foldName(s).split(" ").filter(Boolean);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

function stringSim(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

function tokenSim(a: string, b: string): number {
  if (a === b) return 1;
  // Initiale: «h» passt zu «hans»
  if ((a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b))) return 0.8;
  // Tippfehler nur bei längeren Namen zulassen
  if (Math.min(a.length, b.length) < 4) return 0;
  return stringSim(a, b);
}

/** Alle Reihenfolgen der Namensteile zusammengeschrieben (bis 4 Teile, sonst nur die gegebene). */
function joinedPermutations(tokens: string[]): Set<string> {
  if (tokens.length > 4) return new Set([tokens.join("")]);
  const out = new Set<string>();
  const walk = (rest: string[], acc: string) => {
    if (!rest.length) {
      out.add(acc);
      return;
    }
    rest.forEach((t, i) => walk([...rest.slice(0, i), ...rest.slice(i + 1)], acc + t));
  };
  walk(tokens, "");
  return out;
}

/** Ähnlichkeit zweier Namen zwischen 0 und 1 (unabhängig von der Reihenfolge der Namensteile). */
export function nameSimilarity(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return 0;
  const ja = [...ta].sort().join(" ");
  const jb = [...tb].sort().join(" ");
  if (ja === jb) return 1;
  // Zusammengeschriebene Doppelnamen («Hanspeter» = «Hans-Peter»), in beliebiger Reihenfolge
  const pa = joinedPermutations(ta);
  if ([...joinedPermutations(tb)].some((x) => pa.has(x))) return 0.97;

  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const used = new Set<number>();
  let sum = 0;
  for (const t of short) {
    let best = 0;
    let bestIdx = -1;
    long.forEach((u, i) => {
      if (used.has(i)) return;
      const s = tokenSim(t, u);
      if (s > best) {
        best = s;
        bestIdx = i;
      }
    });
    if (bestIdx >= 0) used.add(bestIdx);
    sum += best;
  }
  // Ein einzelner Name (nur Vor- oder Nachname) ist nie eine sichere Übereinstimmung
  const coverage = short.length === 1 && long.length > 1 ? 0.75 : 0.85 + (0.15 * short.length) / long.length;
  const tokenScore = (sum / short.length) * coverage;
  return Math.max(tokenScore, stringSim(ja, jb) * 0.95);
}

export type MemberCandidate = { id: string; name: string };
export type MemberMatch = {
  /** Automatisch zugeordnetes Mitglied (nur bei sicherer, eindeutiger Übereinstimmung). */
  memberId: string | null;
  score: number;
  /** Beste Vorschläge, absteigend (höchstens 3). */
  suggestions: Array<{ id: string; name: string; score: number }>;
};

/** Mitglieder für einen Namen bewerten. */
export function matchMember(name: string, members: readonly MemberCandidate[]): MemberMatch {
  const scored = members
    .map((m) => ({ id: m.id, name: m.name, score: Math.round(nameSimilarity(name, m.name) * 1000) / 1000 }))
    .filter((m) => m.score >= SUGGEST_SCORE)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "de-CH"));
  const best = scored[0];
  const second = scored[1];
  const unique = !!best && (!second || best.score - second.score >= AMBIGUITY_MARGIN);
  return {
    memberId: best && best.score >= AUTO_MATCH_SCORE && unique ? best.id : null,
    score: best?.score ?? 0,
    suggestions: scored.slice(0, 3),
  };
}

/**
 * Alle Namen zuordnen. Dasselbe Mitglied wird höchstens einmal automatisch vergeben
 * (an den Namen mit der höchsten Übereinstimmung); die anderen bleiben offen.
 */
export function matchAllMembers(names: readonly string[], members: readonly MemberCandidate[]): MemberMatch[] {
  const results = names.map((n) => matchMember(n, members));
  const bestFor = new Map<string, number>();
  results.forEach((r, i) => {
    if (!r.memberId) return;
    const prev = bestFor.get(r.memberId);
    if (prev === undefined || results[prev]!.score < r.score) bestFor.set(r.memberId, i);
  });
  return results.map((r, i) => (r.memberId && bestFor.get(r.memberId) !== i ? { ...r, memberId: null } : r));
}
