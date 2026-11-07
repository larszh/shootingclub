import "server-only";
import { AiError, AiUnavailable, streamText, type AiActor } from "@/lib/ai";
import type { Locale } from "@/lib/i18n/locales";
import type { ModuleKey } from "@/lib/modules";
import type { Permission } from "@/lib/permissions";
import { visibleFaq } from "@/app/(app)/help/faq-access";
import { trimHistory, type ChatTurn } from "./history";
import { visibleRoutes } from "./knowledge";
import { buildClubHelpSystem, buildHelpExtra, buildSupportSystem, firstNameOf } from "./prompt";
import { hitHelpLimit } from "./limits";
import { loadSupportDocs } from "./docs";

/** Antwortlänge: kurze Antworten, Denken zählt mit. */
const HELP_MAX_TOKENS = 4000;
const SUPPORT_MAX_TOKENS = 8000;

/** Benötigte Felder aus getAppContext(). */
export type HelpContext = {
  user: { id: string; name: string; isSuperAdmin: boolean };
  tenant: { id: string; name: string; role: string | null; enabledModules: readonly ModuleKey[] } | null;
  can: (perm: Permission) => boolean;
};

function preparedTurns(messages: readonly ChatTurn[]): ChatTurn[] {
  const turns = trimHistory(messages);
  if (turns.at(-1)?.role !== "user") throw new AiError("badRequest");
  return turns;
}

/** Eingaben für die Vereins-Hilfe (ohne Aufruf; für Tests und den Route-Handler). */
export function clubHelpPrompt(ctx: HelpContext & { tenant: NonNullable<HelpContext["tenant"]> }, locale: Locale) {
  const isAdmin = ctx.can("tenant.manage");
  const access = {
    isAdmin,
    can: ctx.can,
    isSuperAdmin: ctx.user.isSuperAdmin,
    role: ctx.tenant.role,
    enabledModules: ctx.tenant.enabledModules,
  };
  const system = buildClubHelpSystem({
    locale,
    role: ctx.tenant.role,
    isSuperAdmin: ctx.user.isSuperAdmin,
    enabledModules: ctx.tenant.enabledModules,
    routes: visibleRoutes(access, locale, true),
    faq: visibleFaq(access, locale),
  });
  const systemExtra = buildHelpExtra({ locale, firstName: firstNameOf(ctx.user.name), clubName: ctx.tenant.name });
  return { system, systemExtra };
}

/**
 * Vereins-Hilfe (Funktion «help», Schlüssel des Vereins). Wirft AiUnavailable/AiError vor dem Stream.
 */
export async function openHelpStream(opts: { ctx: HelpContext; locale: Locale; messages: readonly ChatTurn[]; signal?: AbortSignal }): Promise<ReadableStream<Uint8Array>> {
  const { ctx } = opts;
  const tenant = ctx.tenant;
  if (!tenant) throw new AiUnavailable("clubOff");
  if (!ctx.can("ai.use")) throw new AiUnavailable("noAccess");
  const messages = preparedTurns(opts.messages);
  const hit = hitHelpLimit("help", `${tenant.id}:${ctx.user.id}`);
  if (!hit.ok) throw new AiError("rateLimited", { retryAfterSec: hit.retryAfterSec });
  const { system, systemExtra } = clubHelpPrompt({ ...ctx, tenant }, opts.locale);
  const actor: AiActor = { id: ctx.user.id, isSuperAdmin: ctx.user.isSuperAdmin, role: tenant.role };
  return streamText({
    scope: "tenant",
    tenantId: tenant.id,
    feature: "help",
    actor,
    system,
    systemExtra,
    messages,
    maxTokens: HELP_MAX_TOKENS,
    signal: opts.signal,
  });
}

/** Eingaben für den Plattform-Support. */
export async function supportPrompt(ctx: { user: { name: string } }, locale: Locale) {
  const docs = await loadSupportDocs();
  // Super-Admins sehen alle Hilfe-Einträge.
  const faq = visibleFaq({ isAdmin: true, can: () => true }, locale);
  const system = buildSupportSystem({ docs, faq, locale });
  const systemExtra = buildHelpExtra({ locale, firstName: firstNameOf(ctx.user.name) });
  return { system, systemExtra };
}

/** Plattform-Support (Funktion «support», Plattform-Schlüssel, nur Super-Admins). */
export async function openSupportStream(opts: { user: { id: string; name: string; isSuperAdmin: boolean }; locale: Locale; messages: readonly ChatTurn[]; signal?: AbortSignal }): Promise<ReadableStream<Uint8Array>> {
  if (!opts.user.isSuperAdmin) throw new AiUnavailable("noAccess");
  const messages = preparedTurns(opts.messages);
  const hit = hitHelpLimit("support", opts.user.id);
  if (!hit.ok) throw new AiError("rateLimited", { retryAfterSec: hit.retryAfterSec });
  const { system, systemExtra } = await supportPrompt(opts, opts.locale);
  return streamText({
    scope: "platform",
    feature: "support",
    actor: { id: opts.user.id, isSuperAdmin: true, role: null },
    system,
    systemExtra,
    messages,
    maxTokens: SUPPORT_MAX_TOKENS,
    signal: opts.signal,
  });
}
