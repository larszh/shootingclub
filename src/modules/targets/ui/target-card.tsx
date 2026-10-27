import Link from "next/link";
import { EyeOff, Globe, Printer, User, Users } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import type { TargetView } from "@/modules/targets/queries";
import { subjectLabel, subjectMeta } from "@/modules/targets/types";
import { TargetPreview } from "./target-preview";
import { TargetFavoriteButton } from "./target-favorite";
import { cn } from "@/lib/utils";

/**
 * Karte in der Galerie. Die ganze Karte öffnet die Detailansicht; Favorit und
 * Schnelldruck liegen als eigene Buttons darüber (keine verschachtelten Links).
 */
export function TargetCard({ target, href }: { target: TargetView; href: string }) {
  const t = target;
  const isNew = !!subjectMeta(t.subject)?.isNew && t.scope === "global";
  return (
    <Card className={cn("group relative overflow-hidden hover:border-ink/30 transition-colors h-full flex flex-col", t.hidden && "opacity-60")}>
      <div className="relative aspect-[210/297] bg-white border-b border-line">
        <TargetPreview target={t} size={t.paperSizes.includes("A4") ? "A4" : t.paperSizes[0] ?? "A6"} className="absolute inset-0 h-full w-full" />
        {isNew ? <span className="absolute top-2 left-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-ink shadow-sm">Neu</span> : null}
      </div>
      <div className="p-3 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="font-medium truncate flex-1">
            <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">{t.name}</Link>
          </h3>
          {t.scope === "global" ? <Globe className="h-3.5 w-3.5 text-ink-3 shrink-0" aria-label="Global" /> : t.scope === "mine" ? <User className="h-3.5 w-3.5 text-ink-3 shrink-0" aria-label="Meine" /> : <Users className="h-3.5 w-3.5 text-ink-3 shrink-0" aria-label="Verein" />}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge>{subjectLabel(t.subject)}</Badge>
          <Badge tone="outline">{t.paperSizes.join(" · ")}</Badge>
          {t.hidden ? <Badge tone="warn"><EyeOff className="h-3 w-3 mr-1" />versteckt</Badge> : null}
        </div>
      </div>
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-2">
        <TargetFavoriteButton targetId={t.id} favorite={t.favorite} />
        <a
          href={`/targets/${t.id}/print?auto=1`}
          target="_blank"
          rel="noopener"
          aria-label={`${t.name} drucken`}
          title="Drucken"
          className="press flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-neutral-600 shadow-sm hover:text-neutral-900"
        >
          <Printer className="h-4 w-4" />
        </a>
      </div>
    </Card>
  );
}
