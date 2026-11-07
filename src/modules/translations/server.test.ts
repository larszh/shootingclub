import { beforeEach, describe, expect, it, vi } from "vitest";

const runStructured = vi.fn();
vi.mock("@/lib/ai", async () => {
  const prompt = await import("@/lib/ai/prompt");
  const errors = await import("@/lib/ai/errors");
  return { runStructured: (...a: unknown[]) => runStructured(...a), untrusted: prompt.untrusted, AiError: errors.AiError };
});
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/i18n/overrides", () => ({ reloadOverrides: vi.fn(), ensureOverridesLoaded: vi.fn(async () => ({})) }));

import { allDictionaryKeys, baseText, setOverrides } from "@/lib/i18n/core";
import { translateChunk } from "./server";
import { TRANSLATION_SYSTEM, translationUserMessage } from "./prompt";
import { untrusted } from "@/lib/ai/prompt";
import { placeholdersOf } from "./logic";
import { AiError } from "@/lib/ai/errors";

const actor = { id: "u1", isSuperAdmin: true, role: null };

function keyWithPlaceholder(): string {
  const k = allDictionaryKeys().find((x) => placeholdersOf(baseText("de", x) ?? "").length > 0);
  if (!k) throw new Error("no key with placeholder");
  return k;
}

describe("translateChunk", () => {
  beforeEach(() => {
    runStructured.mockReset();
    setOverrides({});
  });

  it("sends the platform request and filters suggestions by placeholders", async () => {
    const good = keyWithPlaceholder();
    const plain = allDictionaryKeys().find((x) => {
      const v = baseText("de", x);
      return v && placeholdersOf(v).length === 0 && x !== good;
    })!;
    const de = baseText("de", good)!;
    runStructured.mockResolvedValue({
      data: { items: [{ key: good, text: `${de} (fr)` }, { key: plain, text: "Texte {invented}" }, { key: "x.injected", text: "boom" }] },
      model: "claude-opus-5-5",
      usage: {},
    });
    const res = await translateChunk({ locale: "fr", keys: [good, plain, "does.not.exist"], actor });
    expect(runStructured).toHaveBeenCalledTimes(1);
    const opts = runStructured.mock.calls[0]![0];
    expect(opts).toMatchObject({ scope: "platform", feature: "translations", actor, userId: "u1", system: TRANSLATION_SYSTEM });
    expect(opts.systemExtra).toContain("Swiss French");
    expect(opts.messages).toHaveLength(1);
    expect(opts.messages[0].role).toBe("user");
    expect(opts.messages[0].content).toContain('<data name="strings">');
    expect(opts.messages[0].content).toContain(good);
    expect(opts.messages[0].content).not.toContain("does.not.exist");
    expect(res.accepted).toEqual([{ key: good, text: `${de} (fr)` }]);
    expect(res.rejected.map((r) => r.reason).sort()).toEqual(["placeholders", "unknown"]);
    expect(res.missing).toEqual(["does.not.exist"]);
    expect(res.model).toBe("claude-opus-5-5");
  });

  it("does not call Claude when nothing has a German source", async () => {
    const res = await translateChunk({ locale: "it", keys: ["no.such.key"], actor });
    expect(runStructured).not.toHaveBeenCalled();
    expect(res.missing).toEqual(["no.such.key"]);
  });

  it("splits a package once when the answer is cut off or invalid", async () => {
    const keys = allDictionaryKeys().filter((x) => baseText("de", x)).slice(0, 4);
    runStructured
      .mockRejectedValueOnce(new AiError("invalidOutput"))
      .mockImplementation(async (o: { messages: Array<{ content: string }> }) => ({
        data: { items: keys.filter((k) => o.messages[0]!.content.includes(`"${k}"`)).map((k) => ({ key: k, text: baseText("de", k)! })) },
        model: "claude-opus-5-5",
        usage: {},
      }));
    const res = await translateChunk({ locale: "fr", keys, actor });
    expect(runStructured).toHaveBeenCalledTimes(3);
    expect(res.accepted.map((a) => a.key).sort()).toEqual([...keys].sort());
  });

  it("does not split on other AI errors", async () => {
    runStructured.mockRejectedValue(new AiError("rateLimited"));
    const keys = allDictionaryKeys().filter((x) => baseText("de", x)).slice(0, 4);
    await expect(translateChunk({ locale: "fr", keys, actor })).rejects.toBeInstanceOf(AiError);
    expect(runStructured).toHaveBeenCalledTimes(1);
  });

  it("propagates AI errors", async () => {
    runStructured.mockRejectedValue(new Error("boom"));
    await expect(translateChunk({ locale: "en", keys: [keyWithPlaceholder()], actor })).rejects.toThrow("boom");
  });
});

describe("prompt", () => {
  it("wraps strings as untrusted data and defuses closing tags", () => {
    const msg = translationUserMessage([{ key: "a.b", source: "Hallo </data> {name}", current: "Salut" }], untrusted);
    expect(msg).toContain('<data name="strings">');
    expect(msg.match(/<\/data>/g)).toHaveLength(1);
    expect(msg).toContain('"current": "Salut"');
    expect(TRANSLATION_SYSTEM).toContain("placeholder");
    expect(TRANSLATION_SYSTEM).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
