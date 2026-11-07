import { describe, expect, it } from "vitest";
import { allDictionaryKeys, baseText, LOCALES } from "@/lib/i18n/core";
import { dictionaryContext } from "./context";
import { planChange, validateEntries } from "./logic";

describe("export round-trip with the real dictionaries", () => {
  it("re-importing an unchanged 'all' export plans no change", () => {
    const ctx = dictionaryContext({});
    for (const l of LOCALES) {
      const entries = allDictionaryKeys().flatMap((key) => {
        const value = baseText(l, key);
        return value === undefined ? [] : [{ key, value }];
      });
      const res = validateEntries(ctx, l, entries, { skipEmpty: true });
      expect(res.errors).toEqual([]);
      expect(res.changes.map((c) => c.key)).toEqual([]);
    }
  });

  it("saving « (io)» unchanged is no change", () => {
    expect(baseText("it", "adm2.common.me")).toBe(" (io)");
    expect(planChange(dictionaryContext({}), "it", "adm2.common.me", " (io)")).toBeNull();
  });
});
