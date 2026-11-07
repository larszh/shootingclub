import { describe, expect, it } from "vitest";
import { chatStorageBase, chatStorageKey, HELP_MAX_ANSWER_CHARS, HELP_MAX_QUESTION_CHARS, HELP_MAX_TURNS, helpRequestSchema, trimHistory, type ChatTurn } from "./history";

const conv = (n: number): ChatTurn[] =>
  Array.from({ length: n }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: `m${i}` }) as ChatTurn);

describe("trimHistory", () => {
  it("keeps short conversations unchanged", () => {
    const c = conv(5);
    expect(trimHistory(c)).toEqual(c);
  });

  it("keeps only the last HELP_MAX_TURNS messages and starts with a user message", () => {
    const c = conv(41); // ends with user (index 40)
    const out = trimHistory(c);
    expect(out.length).toBeLessThanOrEqual(HELP_MAX_TURNS);
    expect(out[0]!.role).toBe("user");
    expect(out.at(-1)).toEqual({ role: "user", content: "m40" });
  });

  it("drops a leading assistant message after cutting", () => {
    const out = trimHistory(conv(22), { maxTurns: 4 }); // last 4: m18(u) m19(a) m20(u) m21(a)
    expect(out[0]!.role).toBe("user");
    const out2 = trimHistory(conv(23), { maxTurns: 4 }); // m19(a) m20 m21 m22 → drop m19
    expect(out2.map((t) => t.content)).toEqual(["m20", "m21", "m22"]);
  });

  it("removes empty messages and merges consecutive messages of the same role", () => {
    const out = trimHistory([
      { role: "assistant", content: "hello" },
      { role: "user", content: "a" },
      { role: "user", content: "  " },
      { role: "user", content: "b" },
      { role: "assistant", content: "" },
      { role: "user", content: "c" },
    ]);
    expect(out).toEqual([{ role: "user", content: "a\n\nb\n\nc" }]);
  });

  it("clips long questions and answers", () => {
    const out = trimHistory([
      { role: "user", content: "q".repeat(5000) },
      { role: "assistant", content: "a".repeat(9000) },
      { role: "user", content: "next" },
    ]);
    expect(out[0]!.content.length).toBe(HELP_MAX_QUESTION_CHARS);
    expect(out[1]!.content.length).toBe(HELP_MAX_ANSWER_CHARS);
  });

  it("respects the total character budget but always keeps the current question", () => {
    const turns: ChatTurn[] = [
      { role: "user", content: "x".repeat(900) },
      { role: "assistant", content: "y".repeat(900) },
      { role: "user", content: "z".repeat(900) },
    ];
    const out = trimHistory(turns, { maxChars: 1000 });
    expect(out).toEqual([{ role: "user", content: "z".repeat(900) }]);
    expect(trimHistory([{ role: "user", content: "only" }], { maxChars: 1 })).toEqual([{ role: "user", content: "only" }]);
  });
});

describe("helpRequestSchema", () => {
  it("accepts a valid request and rejects bad roles or empty lists", () => {
    expect(helpRequestSchema.safeParse({ messages: [{ role: "user", content: "Hi" }] }).success).toBe(true);
    expect(helpRequestSchema.safeParse({ messages: [] }).success).toBe(false);
    expect(helpRequestSchema.safeParse({ messages: [{ role: "system", content: "x" }] }).success).toBe(false);
  });
});

describe("chatStorageKey", () => {
  it("is per person and club, with a common base for cleaning up", () => {
    const a = chatStorageKey("sc-ai-help-chat", "u1", "t1");
    expect(a).toBe("sc-ai-help-chat:u1:t1");
    expect(chatStorageKey("sc-ai-help-chat", "u2", "t1")).not.toBe(a);
    expect(chatStorageKey("sc-ai-help-chat", "u1", "t2")).not.toBe(a);
    expect(chatStorageKey("sc-ai-support-chat", "u1", null)).toBe("sc-ai-support-chat:u1:-");
    expect(chatStorageBase(a)).toBe("sc-ai-help-chat");
    expect(chatStorageBase("sc-ai-help-chat")).toBe("sc-ai-help-chat");
  });
});

describe("helpRequestSchema extra keys", () => {
  it("rejects unknown keys", () => {
    expect(helpRequestSchema.safeParse({ messages: [{ role: "user", content: "Hi" }], pad: "x" }).success).toBe(false);
    expect(helpRequestSchema.safeParse({ messages: [{ role: "user", content: "Hi", x: 1 }] }).success).toBe(false);
  });
});
