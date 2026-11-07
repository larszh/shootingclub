/**
 * KI (Claude) – serverseitige API. Client-sichere Konstanten: "@/lib/ai/types",
 * Stream lesen im Browser: "@/lib/ai/stream-client", Prompt-Hilfen: "@/lib/ai/prompt".
 */
import "server-only";

export * from "./types";
export * from "./errors";
export * from "./prompt";
export { computeAvailability, type AiActor, type Availability, type AvailabilityInput, type PlatformAiState, type TenantAiState } from "./availability";
export { createRateLimiter, type RateLimiter } from "./rate-limit";
export { startOfMonthZurich } from "./month";
export {
  aiAvailability, getAiClient, createAiClient, setAiClientFactory, getPlatformAiSettings, getTenantAiSettings,
  type AiClientFactory, type AiClientResult, type AiContextLike, type AiScopeRef, type PlatformAiSettingsView, type TenantAiSettingsView,
} from "./client";
export { logAiUsage, monthTokensUsed, usageSummary, totalTokens, usageFrom, type AiTokenUsage, type AiUsageSummary, type LogUsageInput } from "./usage";
export { saveKey, removeKey, testKey, testStoredKey, encryptApiKey, type SaveKeyResult, type TestKeyResult } from "./keys";
export {
  runText, runStructured, streamText, aiStreamResponse, setAiRateLimiters, AI_BETAS,
  type AiMessage, type AiRunOptions, type AiStreamOptions, type AiTextResult, type AiStructuredResult,
} from "./run";
export { aiCacheKey, getAiCache, setAiCache, purgeExpiredAiCache, sourceHash } from "./cache";
