import { describe, expect, it } from "vitest";
import { CROSSBOW_TARGET_PRESETS, TARGET_PRESETS } from "./presets";
import { PARAM_INFO, TARGET_CATEGORIES, TARGET_SUBJECTS, subjectFields, type TargetSubject } from "./types";
import { renderTarget } from "./svg";
import { isKnownTargetText, localizeTarget, localizeTargetName, PRESET_NAMES, targetTextTranslator, translateTargetText } from "./target-i18n";

const LANGS = ["fr", "it", "en"] as const;

/** Texte in <text>-Elementen eines SVG (entschärft). */
function svgTexts(svg: string): string[] {
  return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
}

const GENERATED = TARGET_SUBJECTS.filter((s) => s.key !== "UPLOAD").map((s) => s.key as TargetSubject);

describe("target-i18n", () => {
  it("Deutsch und unbekannte Texte bleiben unverändert", () => {
    expect(translateTargetText("Durchmesser (mm)", "de")).toBe("Durchmesser (mm)");
    expect(translateTargetText("Clubeigene Scheibe", "fr")).toBe("Clubeigene Scheibe");
    expect(targetTextTranslator("de")("Kopf")).toBe("Kopf");
  });

  it("übersetzt Formularfelder, Optionen, Hinweise und Sujet-Beschreibungen vollständig", () => {
    const texts = new Set<string>();
    for (const info of Object.values(PARAM_INFO)) {
      texts.add(info.label);
      if (info.hint) texts.add(info.hint);
    }
    for (const c of TARGET_CATEGORIES) texts.add(c.label);
    for (const s of TARGET_SUBJECTS) {
      texts.add(s.description);
      for (const f of subjectFields(s.key)) {
        if (f.label) texts.add(f.label);
        if (f.hint) texts.add(f.hint);
        for (const o of f.options ?? []) texts.add(o.label);
      }
    }
    expect([...texts].filter((s) => !isKnownTargetText(s))).toEqual([]);
    for (const lang of LANGS) {
      expect([...texts].filter((s) => !translateTargetText(s, lang).trim())).toEqual([]);
    }
  });

  it("übersetzt alle Beschriftungen, Legenden und Hinweise der generierten Sujets", () => {
    const unknown = new Set<string>();
    for (const subject of GENERATED) {
      const fields = subjectFields(subject);
      const variants = fields.find((f) => f.key === "variant")?.options?.map((o) => o.value) ?? [undefined];
      for (const variant of variants) {
        for (const params of [{ variant }, { variant, originalDistanceM: 300, shotDistanceM: 25 }, { variant, count: 7, threats: 9, threatPos: 8 }]) {
          for (const size of ["A4", "A6"] as const) {
            const r = renderTarget(subject, size, params);
            if (r.note && !isKnownTargetText(r.note)) unknown.add(`${subject} note: ${r.note}`);
            for (const s of svgTexts(r.svg)) if (!isKnownTargetText(s)) unknown.add(`${subject}: ${s}`);
          }
        }
      }
    }
    expect([...unknown]).toEqual([]);
  });

  it("Hinweiszeile und SVG in der Sprache, Deutsch unverändert", () => {
    const params = { originalDistanceM: 300, shotDistanceM: 25 };
    const de = renderTarget("SWISS_A", "A4", params);
    expect(de.note).toMatch(/^A-Scheibe 10er \(CH-Stil\) · nachempfunden, Masse angenähert · Massstab 1:/);
    expect(renderTarget("SWISS_A", "A4", params, "de")).toEqual(de);
    const en = renderTarget("SWISS_A", "A4", params, "en");
    expect(en.note).toMatch(/^A target, 10-point \(Swiss style\) · replica, approximate dimensions · Scale 1:\d+ · simulates 300 m at 25 m/);
    expect(en.svg).toContain("Scale 1:");
    const fr = renderTarget("TAC_SHOOT_NOSHOOT", "A4", { count: 4, threats: 6 }, "fr");
    expect(fr.note).toContain("4 silhouettes · 4 menaces (6 souhaitées, seulement 4 silhouettes)");
    expect(fr.svg).toContain("Zones : A = centre");
    const it = renderTarget("AIR_RIFLE_SHEET", "A4", { sighter: true }, "it");
    expect(svgTexts(it.svg)).toContain("PROVA");
    const seq = renderTarget("TAC_SEQUENCE", "A4", {}, "en").note ?? "";
    expect(seq).toMatch(/A=(Solid|Stripes|Dots|Grid|Blank)/);
  });

  it("übersetzt die Namen und Beschreibungen aller globalen Vorlagen", () => {
    const presets = [...TARGET_PRESETS, ...CROSSBOW_TARGET_PRESETS.map((p) => p.target)];
    expect(presets.map((p) => p.name).filter((n) => !PRESET_NAMES[n])).toEqual([]);
    for (const lang of LANGS) {
      for (const p of presets) {
        const out = localizeTarget({ name: p.name, description: p.description ?? null, scope: "global" }, lang);
        expect(out.name).not.toBe("");
        if (p.description) expect(out.description, `${lang}: ${p.name}`).not.toBe(p.description);
      }
    }
  });

  it("übersetzt nur globale, unveränderte Vorlagen", () => {
    const p = TARGET_PRESETS[0]!;
    expect(localizeTarget({ name: p.name, description: p.description ?? null, scope: "tenant" }, "fr").name).toBe(p.name);
    expect(localizeTarget({ name: p.name, description: p.description ?? null, scope: "global" }, "de").name).toBe(p.name);
    const changed = localizeTarget({ name: p.name, description: "Eigene Beschreibung", scope: "global" }, "it");
    expect(changed.name).not.toBe(p.name);
    expect(changed.description).toBe("Eigene Beschreibung");
    expect(localizeTarget({ name: "Unsere Clubscheibe", description: null, tenantId: null, ownerUserId: null }, "en").name).toBe("Unsere Clubscheibe");
    expect(localizeTarget({ name: p.name, description: null, tenantId: null, ownerUserId: null }, "en").name).toBe("10-ring pistol");
    expect(localizeTargetName(p.name, false, "en")).toBe(p.name);
    expect(localizeTargetName(p.name, true, "en")).toBe("10-ring pistol");
  });
});
