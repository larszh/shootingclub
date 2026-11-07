import { afterEach, describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/ai/rate-limit";
import { AI_ERROR_CODES, AI_UNAVAILABLE_REASONS } from "@/lib/ai/types";
import { lookup } from "@/lib/i18n/core";
import { HELP_RATE, helpFailureKey, helpFailureStatus, hitHelpLimit, setHelpRateLimiters } from "./limits";

afterEach(() => setHelpRateLimiters(null));

describe("help rate limit", () => {
  it("allows 20 questions per 10 minutes and then blocks with a retry time", () => {
    let now = 1_000_000;
    setHelpRateLimiters({ help: createRateLimiter({ ...HELP_RATE, now: () => now }) });
    for (let i = 0; i < 20; i++) expect(hitHelpLimit("help", "t1:u1").ok).toBe(true);
    const blocked = hitHelpLimit("help", "t1:u1");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBe(600);
    // andere Person ist nicht betroffen
    expect(hitHelpLimit("help", "t1:u2").ok).toBe(true);
    now += 10 * 60_000 + 1;
    expect(hitHelpLimit("help", "t1:u1").ok).toBe(true);
  });

  it("keeps help and support limits separate", () => {
    setHelpRateLimiters({ help: createRateLimiter({ limit: 1, windowMs: 60_000 }) });
    expect(hitHelpLimit("help", "k").ok).toBe(true);
    expect(hitHelpLimit("help", "k").ok).toBe(false);
    expect(hitHelpLimit("support", "k").ok).toBe(true);
  });
});

describe("helpFailureKey", () => {
  it("shows a friendly «not set up» text for club setup problems", () => {
    for (const reason of ["clubOff", "noKey", "noConsent", "featureOff", "clubsNotAllowed"] as const) {
      expect(helpFailureKey("help", { kind: "unavailable", reason })).toBe("aihelp.unavailable.notSetUp");
    }
    expect(helpFailureKey("help", { kind: "error", code: "invalidKey" })).toBe("aihelp.error.invalidKey");
    expect(helpFailureKey("help", { kind: "unavailable", reason: "limitReached" })).toBe("aihelp.unavailable.limitReached");
    expect(helpFailureKey("help", { kind: "error", code: "overloaded" })).toBe("ai.error.overloaded");
  });

  it("uses the generic texts for the support assistant", () => {
    expect(helpFailureKey("support", { kind: "unavailable", reason: "noKey" })).toBe("ai.unavailable.noKey");
    expect(helpFailureKey("support", { kind: "error", code: "invalidKey" })).toBe("ai.error.invalidKey");
  });

  it("every key it can return is translated in all locales", () => {
    const keys = new Set<string>();
    for (const mode of ["help", "support"] as const) {
      for (const reason of AI_UNAVAILABLE_REASONS) keys.add(helpFailureKey(mode, { kind: "unavailable", reason }));
      for (const code of AI_ERROR_CODES) keys.add(helpFailureKey(mode, { kind: "error", code }));
    }
    for (const k of keys) for (const l of ["de", "fr", "it", "en"] as const) expect(lookup(l, k), `${l}:${k}`).not.toBe(k);
  });

  it("maps failures to HTTP status codes", () => {
    expect(helpFailureStatus({ kind: "error", code: "rateLimited" })).toBe(429);
    expect(helpFailureStatus({ kind: "unavailable", reason: "limitReached" })).toBe(429);
    expect(helpFailureStatus({ kind: "unavailable", reason: "noAccess" })).toBe(403);
    expect(helpFailureStatus({ kind: "unavailable", reason: "noKey" })).toBe(409);
    expect(helpFailureStatus({ kind: "error", code: "badRequest" })).toBe(400);
  });
});
