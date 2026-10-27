import { brandCss } from "@/lib/brand";

/**
 * Überschreibt die Akzent-Tokens (--accent, --accent-ink, --accent-soft, --accent-2, --accent-2-ink)
 * mit den Vereinsfarben – für hell und dunkel. Ohne gültige Farbe wird nichts gerendert.
 * Wird im App-Layout eingebunden; Seiten ausserhalb (Login, Druckansichten) bleiben neutral.
 */
export function BrandTheme({ brandColor, brandColor2 }: { brandColor: string | null | undefined; brandColor2?: string | null }) {
  const css = brandCss(brandColor, brandColor2);
  if (!css) return null;
  return <style data-brand-theme dangerouslySetInnerHTML={{ __html: css }} />;
}
