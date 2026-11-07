/**
 * Schützen-Coach: Prompt und Ausgabeschema (rein, ohne Server-Code).
 * Der System-Prompt ist stabil (gecacht); Sprache und Datum kommen in systemExtra.
 */
import * as z from "zod/v4";
import { UNTRUSTED_NOTICE, answerLanguageLine, untrusted } from "@/lib/ai/prompt";
import { formatCoachSummary, type CoachSummary } from "./summary";

export const COACH_SYSTEM = [
  "You are a friendly, encouraging shooting coach for members of a Swiss sport shooting club (rifle and pistol, e.g. 300 m, 50 m, 25 m, 10 m air).",
  "You receive statistics that the app has already computed from ONE member's own results. Write a short personal evaluation for this member.",
  "",
  "Rules:",
  "- Base everything only on the data provided. Do not invent results, competitions or numbers. Use the trend and averages as given; do not recalculate them.",
  "- Be neutral and encouraging. Mention real progress, never shame. If there is little data, say so briefly and keep suggestions general.",
  "- Give practical sport-shooting advice (e.g. dry-fire practice, breathing rhythm, trigger control, follow-through, consistent position and routine, series pacing, mental preparation).",
  "- No medical, health, nutrition or medication advice, no diagnoses. Do not comment on eyesight or physical conditions beyond suggesting the member talk to a qualified professional if something bothers them.",
  "- No weapon modifications, ammunition or reloading advice. Safety: only the generic reminder that range rules and the range officer's instructions always apply.",
  "- Never compare the member with other people and do not guess their age, gender or skill class.",
  "- Address the member directly and informally (du/tu/tu/you).",
  "",
  "Output fields:",
  "- summary: 2 to 4 sentences overall evaluation.",
  "- strengths: 1 to 3 short points (what goes well, with numbers where helpful).",
  "- focus: 1 to 3 short points to work on.",
  "- training: one concrete training suggestion for the next session: a short title and 2 to 5 concrete steps.",
  "Keep every point to one or two sentences. Plain text only, no Markdown.",
  "",
  UNTRUSTED_NOTICE,
].join("\n");

export const coachSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  focus: z.array(z.string()),
  training: z.object({ title: z.string(), steps: z.array(z.string()) }),
});

export type CoachOutput = z.infer<typeof coachSchema>;

/** Ergebnis für die Anzeige (bereinigt). */
export type CoachResult = {
  summary: string;
  strengths: string[];
  focus: string[];
  training: { title: string; steps: string[] };
  /** «YYYY-MM-DD» – Datum der Auswertung */
  day: string;
  matchCount: number;
};

function cleanText(s: unknown, max: number): string {
  return typeof s === "string" ? s.replace(/[*_#`]+/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function cleanList(list: unknown, maxItems: number, maxLen: number): string[] {
  return Array.isArray(list) ? list.map((x) => cleanText(x, maxLen)).filter(Boolean).slice(0, maxItems) : [];
}

/** Modellantwort → Anzeige. null, wenn unbrauchbar (keine Zusammenfassung). */
export function normalizeCoachOutput(out: CoachOutput, meta: { day: string; matchCount: number }): CoachResult | null {
  const summary = cleanText(out.summary, 900);
  if (!summary) return null;
  return {
    summary,
    strengths: cleanList(out.strengths, 3, 300),
    focus: cleanList(out.focus, 3, 300),
    training: { title: cleanText(out.training?.title, 120), steps: cleanList(out.training?.steps, 5, 300) },
    day: meta.day,
    matchCount: meta.matchCount,
  };
}

/** Gespeicherten Cache-Eintrag lesen (null bei ungültigem Inhalt). */
export function parseCachedCoach(raw: string | null): { fingerprint: string; result: CoachResult } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { fingerprint?: unknown; result?: CoachResult };
    if (typeof v.fingerprint !== "string" || !v.result || typeof v.result.summary !== "string") return null;
    const r = v.result;
    return {
      fingerprint: v.fingerprint,
      result: {
        summary: cleanText(r.summary, 900),
        strengths: cleanList(r.strengths, 3, 300),
        focus: cleanList(r.focus, 3, 300),
        training: { title: cleanText(r.training?.title, 120), steps: cleanList(r.training?.steps, 5, 300) },
        day: typeof r.day === "string" ? r.day : "",
        matchCount: typeof r.matchCount === "number" ? r.matchCount : 0,
      },
    };
  } catch {
    return null;
  }
}

export function buildCoachPrompt(summary: CoachSummary, opts: { locale: string; today: string }): { system: string; systemExtra: string; user: string } {
  return {
    system: COACH_SYSTEM,
    systemExtra: `${answerLanguageLine(opts.locale)} Today is ${opts.today} (Europe/Zurich).`,
    user: `Here are my own recent shooting results as computed statistics. Please evaluate them.\n\n${untrusted("results", formatCoachSummary(summary))}`,
  };
}
