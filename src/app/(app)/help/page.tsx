import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getAppContext } from "@/lib/tenant";
import { Alert, PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { aiAvailability } from "@/lib/ai";
import { HelpAssistantPanel } from "@/components/ai/help-panel";
import { chatStorageKey, HELP_CHAT_STORAGE_KEY } from "@/modules/ai/help/history";
import { helpSuggestionKeys } from "@/modules/ai/help/suggestions";
import { Faq } from "./faq";
import { visibleFaq } from "./faq-access";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.common.help") };
}

/** Zustand des Hilfe-Assistenten für diese Person. */
async function assistantState(ctx: Awaited<ReturnType<typeof getAppContext>>): Promise<"on" | "limit" | "setup" | "off"> {
  if (!ctx.tenant) return "off";
  try {
    const avail = await aiAvailability(ctx, "help");
    if (avail.ok) return ctx.can("ai.use") ? "on" : "off";
    if (avail.reason === "limitReached") return "limit";
    // Admins mit KI-Rechten bekommen einen Hinweis zum Einrichten (ausser die Plattform erlaubt es nicht).
    if (avail.reason !== "noAccess" && avail.reason !== "clubsNotAllowed" && ctx.can("ai.manage")) return "setup";
    return "off";
  } catch {
    return "off";
  }
}

export default async function HelpPage() {
  const ctx = await getAppContext();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const isAdmin = ctx.tenant ? ctx.can("tenant.manage") : ctx.user.isSuperAdmin;
  const entries = visibleFaq({ isAdmin, can: ctx.can }, locale);
  const showAudienceFilter = entries.some((e) => e.audience === "admin");
  const assistant = await assistantState(ctx);

  return (
    <div>
      <PageHeader title={t("shell.common.help")} subtitle={t("shell.help.subtitle")} back={{ href: "/me", label: t("shell.nav.more") }} />
      {assistant === "on" ? <HelpAssistantPanel suggestions={helpSuggestionKeys(ctx).map((k) => t(k))} storageKey={chatStorageKey(HELP_CHAT_STORAGE_KEY, ctx.user.id, ctx.tenant?.id)} /> : null}
      {assistant === "limit" ? <Alert tone="info" className="mb-4">{t("aihelp.unavailable.limitReached")}</Alert> : null}
      {assistant === "setup" ? (
        <Alert tone="info" className="mb-4" icon={<Sparkles className="h-4 w-4" aria-hidden />} title={t("aihelp.setup.title")}>
          {t("aihelp.setup.text")}{" "}
          <Link href="/admin/ai" className="font-medium underline underline-offset-2">{t("aihelp.setup.link")}</Link>
        </Alert>
      ) : null}
      <Faq entries={entries} isAdmin={showAudienceFilter} />
      <p className="mt-8 text-center text-sm text-ink-3">
        {ctx.tenant ? t("shell.help.askAdminOf", { club: ctx.tenant.name }) : t("shell.help.askAdmin")}
      </p>
    </div>
  );
}
