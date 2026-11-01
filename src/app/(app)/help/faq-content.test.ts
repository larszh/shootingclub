import { describe, expect, it } from "vitest";
import { LOCALES } from "@/lib/i18n/locales";
import { MEMBER_FAQ } from "./faq-member";
import { ADMIN_FAQ } from "./faq-admin";
import { answerLinks, blockTexts, parseInline, plainText, toEntry } from "./faq-types";

const ALL = [...MEMBER_FAQ, ...ADMIN_FAQ];

describe("Hilfe-Inhalte", () => {
  it("eindeutige ids und passende Zielgruppe", () => {
    expect(new Set(ALL.map((e) => e.id)).size).toBe(ALL.length);
    expect(ALL.length).toBe(47);
    expect(MEMBER_FAQ.every((e) => e.audience === "member")).toBe(true);
    expect(ADMIN_FAQ.every((e) => e.audience === "admin")).toBe(true);
  });

  it("jede Sprache hat Frage, Stichworte und dieselbe Antwort-Struktur", () => {
    for (const e of ALL) {
      const shape = (l: (typeof LOCALES)[number]) => e[l].a.map((b) => ("p" in b ? "p" : "ol" in b ? `ol${b.ol.length}` : `ul${b.ul.length}`)).join(",");
      for (const l of LOCALES) {
        expect(e[l].q.trim(), `${e.id}/${l}`).not.toBe("");
        expect(e[l].keywords.trim(), `${e.id}/${l}`).not.toBe("");
        expect(e[l].a.flatMap(blockTexts).every((s) => s.trim().length > 0), `${e.id}/${l}`).toBe(true);
        expect(shape(l), `${e.id}/${l}`).toBe(shape("de"));
        expect(answerLinks(e[l].a), `${e.id}/${l}`).toEqual(answerLinks(e.de.a));
      }
    }
  });

  it("Auszeichnung ist vollständig (keine offenen Sternchen oder Klammern)", () => {
    for (const e of ALL) {
      for (const l of LOCALES) {
        for (const s of e[l].a.flatMap(blockTexts)) {
          const plain = plainText(s);
          expect(plain, `${e.id}/${l}`).not.toMatch(/\*\*|\]\(/);
        }
      }
    }
  });

  it("zerlegt Inline-Auszeichnung", () => {
    expect(parseInline("Unter [Mehr](/me) **fett** und `7KQ2PX`.")).toEqual([
      { kind: "text", text: "Unter " },
      { kind: "link", text: "Mehr", href: "/me" },
      { kind: "text", text: " " },
      { kind: "strong", text: "fett" },
      { kind: "text", text: " und " },
      { kind: "mono", text: "7KQ2PX" },
      { kind: "text", text: "." },
    ]);
  });

  it("bereitet Einträge pro Sprache auf (Französisch mit geschützten Leerzeichen)", () => {
    const fr = toEntry(MEMBER_FAQ[0]!, "fr");
    expect(fr.q).toBe("Comment adhérer à une société ?");
    expect(fr.search).toContain("code d’adhésion");
    const de = toEntry(MEMBER_FAQ[0]!, "de");
    expect(de.q).toBe("Wie trete ich einem Verein bei?");
  });
});
