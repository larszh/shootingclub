import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/tenant";

/**
 * Einstieg des Moduls «ai» (MODULES.href): Wer Claude verwalten darf, landet bei den
 * Einstellungen, alle anderen beim Hilfe-Assistenten auf /help.
 */
export default async function AiEntryPage() {
  const ctx = await getAppContext();
  if (ctx.tenant && ctx.can("ai.manage")) redirect("/admin/ai");
  redirect("/help");
}
