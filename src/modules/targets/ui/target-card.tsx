import Link from "next/link";
import { EyeOff, Globe, User, Users } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import type { TargetView } from "@/modules/targets/queries";
import { subjectLabel } from "@/modules/targets/types";
import { TargetPreview } from "./target-preview";
import { TargetFavoriteButton } from "./target-favorite";
import { cn } from "@/lib/utils";

export function TargetCard({ target, href }: { target: TargetView; href: string }) {
  const t = target;
  return (
    <Link href={href} className="block press">
      <Card className={cn("overflow-hidden hover:border-ink/30 transition-colors h-full", t.hidden && "opacity-60")}>
        <div className="relative aspect-[210/297] bg-white border-b border-line">
          <TargetPreview target={t} size="A6" className="absolute inset-0 h-full w-full" />
          <div className="absolute top-2 right-2"><TargetFavoriteButton targetId={t.id} favorite={t.favorite} /></div>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-1.5">
            <h3 className="font-medium truncate flex-1">{t.name}</h3>
            {t.scope === "global" ? <Globe className="h-3.5 w-3.5 text-ink-3 shrink-0" /> : t.scope === "mine" ? <User className="h-3.5 w-3.5 text-ink-3 shrink-0" /> : <Users className="h-3.5 w-3.5 text-ink-3 shrink-0" />}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge>{subjectLabel(t.subject)}</Badge>
            <Badge tone="outline">{t.paperSizes.join(" · ")}</Badge>
            {t.hidden ? <Badge tone="warn"><EyeOff className="h-3 w-3 mr-1" />versteckt</Badge> : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}
