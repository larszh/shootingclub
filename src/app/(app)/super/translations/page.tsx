import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/tenant";
import { getRequestLocale, getT, isLocale } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
import { aiAvailability } from "@/lib/ai";
import { db } from "@/lib/db";
import { dictionaryKeySet } from "@/modules/translations/context";
import { loadOverrideMapFromDb, OVERRIDE_SCOPE } from "@/modules/translations/server";
import { translationsT } from "@/modules/translations/texts";
import { TranslationsManager, type ManagerProps } from "@/modules/translations/ui/manager";

export async function generateMetadata(): Promise<Metadata> {
  return { title: translationsT(await getRequestLocale())("page.title") };
}

export const dynamic = "force-dynamic";

export default async function TranslationsPage() {
  const user = await requireSuperAdmin();
  const locale = await getRequestLocale();
  const t = translationsT(locale);
  const [overrides, rows, availability] = await Promise.all([
    loadOverrideMapFromDb(),
    db.translationOverride.findMany({ where: { scope: OVERRIDE_SCOPE }, select: { key: true, locale: true } }),
    aiAvailability("platform", "translations", { id: user.id, isSuperAdmin: user.isSuperAdmin, role: null }).catch(() => ({ ok: false as const, reason: "platformOff" as const })),
  ]);
  const keys = dictionaryKeySet();
  const orphanCount = rows.filter((r) => !keys.has(r.key) || !isLocale(r.locale)).length;
  let ai: ManagerProps["ai"] = { ok: true };
  if (!availability.ok) {
    const general = getT(locale)(`ai.unavailable.${availability.reason}`);
    ai = { ok: false, message: general !== `ai.unavailable.${availability.reason}` ? general : t("ai.unavailable") };
  }
  return (
    <div>
      <PageHeader title={t("page.title")} subtitle={t("page.subtitle")} back={{ href: "/super", label: t("page.back") }} />
      <p className="mb-3 text-sm text-ink-3">{t("page.intro")}</p>
      <TranslationsManager locale={locale} overrides={overrides} orphanCount={orphanCount} ai={ai} />
    </div>
  );
}
