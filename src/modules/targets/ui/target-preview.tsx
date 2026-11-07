import { renderTargetSvg } from "@/modules/targets/svg";
import type { TargetView } from "@/modules/targets/queries";
import type { PaperSize, TargetSubject } from "@/modules/targets/types";
import { targetFileUrl } from "@/modules/targets/file-url";
import { cn } from "@/lib/utils";

/** Vorschau einer Scheibe: generiert (SVG inline) oder Upload (Bild/PDF). */
/** locale: Sprache der Beschriftungen im SVG (Standard Deutsch); auf dem Server aus getRequestLocale(), im Client aus useLocale(). */
export function TargetPreview({ target, size, className, locale }: { target: Pick<TargetView, "id" | "subject" | "params" | "mimeType" | "filePath" | "paperSizes">; size?: PaperSize; className?: string; locale?: string | null }) {
  const paper = size ?? target.paperSizes[0] ?? "A4";
  if (target.subject === "UPLOAD") {
    if (target.mimeType === "application/pdf") {
      return <div className={cn("flex items-center justify-center bg-white text-ink-3 text-xs", className)}>PDF</div>;
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={targetFileUrl(target)} alt="" className={cn("object-contain bg-white", className)} />;
  }
  const svg = renderTargetSvg(target.subject as TargetSubject, paper, target.params, locale);
  return <div className={cn("bg-white [&>svg]:h-full [&>svg]:w-full", className)} dangerouslySetInnerHTML={{ __html: svg }} />;
}
