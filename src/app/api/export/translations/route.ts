import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { todayZurich } from "@/lib/time";
import { allDictionaryKeys, baseText, isLocale } from "@/lib/i18n/core";
import { buildExportFile } from "@/modules/translations/logic";
import { loadOverrideMapFromDb } from "@/modules/translations/server";
import { translationsT } from "@/modules/translations/texts";
import { getRequestLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * Export der Übersetzungen einer Sprache als JSON (nur Super-Admin).
 * ?locale=de|fr|it|en&mode=overrides (nur angepasste, Standard) | all (alle wirksamen Texte).
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  const t = translationsT(await getRequestLocale());
  if (!user) return new NextResponse(t("err.notSignedIn"), { status: 401 });
  if (!user.isSuperAdmin) return new NextResponse(t("err.forbidden"), { status: 403 });
  const sp = new URL(req.url).searchParams;
  const locale = sp.get("locale") ?? "";
  if (!isLocale(locale)) return new NextResponse(t("err.badLocale"), { status: 400 });
  const mode = sp.get("mode") === "all" ? "all" : "overrides";
  const overrides = (await loadOverrideMapFromDb())[locale] ?? {};
  const keys = new Set(allDictionaryKeys());
  const entries: Record<string, string> = {};
  if (mode === "all") {
    for (const k of keys) {
      const v = overrides[k] ?? baseText(locale, k);
      if (v !== undefined) entries[k] = v;
    }
  } else {
    for (const [k, v] of Object.entries(overrides)) if (keys.has(k)) entries[k] = v;
  }
  const file = buildExportFile(locale, mode, entries, new Date());
  await audit({ actorId: user.id, actorName: user.name, action: "translations.export", entity: "TranslationOverride", entityId: locale, detail: `${locale} ${mode}: ${Object.keys(entries).length} Texte` });
  const date = todayZurich();
  return new NextResponse(JSON.stringify(file, null, 2) + "\n", {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="standchef-uebersetzungen-${locale}-${mode}-${date}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
