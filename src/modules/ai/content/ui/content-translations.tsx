import "server-only";
import { getRequestLocale, getT } from "@/lib/i18n";
import { getEditorState, type TenantCtx } from "../service";
import type { ContentEntityType } from "../entities";
import { TranslationPanel } from "./translation-panel";

/**
 * Übersetzungen im Editor (Serverkomponente). Ausgeblendet, wenn KI im Verein nicht vorgesehen ist
 * und noch keine Übersetzungen bestehen; bestehende Übersetzungen bleiben auch ohne KI bearbeitbar.
 */
export async function ContentTranslations({ ctx, type, id, title }: { ctx: TenantCtx; type: ContentEntityType; id: string; title?: string }) {
  const state = await getEditorState(ctx, type, id);
  if (!state) return null;
  const hidden = !state.ai.ok && ["clubOff", "clubsNotAllowed", "featureOff", "noAccess", "platformOff"].includes(state.ai.reason);
  if (hidden && state.locales.every((l) => l.status === "missing")) return null;
  const t = getT(await getRequestLocale());
  const labels = { title: t("aicontent.field.title"), description: t("aicontent.field.description"), body: t(type === "rangeRules" ? "aicontent.field.rulesBody" : "aicontent.field.body") };
  return <TranslationPanel state={state} fieldLabels={labels} title={title} />;
}
