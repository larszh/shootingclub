import Link from "next/link";
import { Eye, EyeOff, Globe } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { disciplineLabel, formatDistances } from "@/modules/scores/types";
import type { ProgramView } from "@/modules/scores/queries";
import { FavoriteButton } from "./favorite-button";
import { cn } from "@/lib/utils";

export function ProgramCard({ program, href, showHidden }: { program: ProgramView; href?: string; showHidden?: boolean }) {
  const p = program;
  const body = (
    <Card className={cn("p-4 h-full transition-colors hover:border-ink/30", p.hidden && "opacity-60")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold leading-tight">{p.name}</h3>
            {p.scope === "global" ? <span title="Globales Programm"><Globe className="h-3.5 w-3.5 text-ink-3" /></span> : null}
            {showHidden && p.hidden ? <Badge tone="warn"><EyeOff className="h-3 w-3 mr-1" />versteckt</Badge> : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-ink-3">
            <Badge>{disciplineLabel(p.discipline)}</Badge>
            <Badge tone="outline">{formatDistances(p.totals.distances)}</Badge>
            <Badge tone="outline">{p.totals.shots} Schuss</Badge>
            <Badge tone="outline">{p.stages.length} {p.stages.length === 1 ? "Serie" : "Serien"}</Badge>
          </div>
          {p.description ? <p className="mt-2 text-sm text-ink-3 line-clamp-2">{p.description}</p> : null}
        </div>
        <FavoriteButton programId={p.id} favorite={p.favorite} />
      </div>
    </Card>
  );
  return href ? <Link href={href} className="block press">{body}</Link> : body;
}

export function HiddenIcon({ hidden }: { hidden: boolean }) {
  return hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />;
}
