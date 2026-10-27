import { Megaphone, Pin } from "lucide-react";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";
import { formatDateZurich } from "@/lib/time";
import type { AnnouncementView } from "../queries";
import { RichText } from "./bits";

const LONG = 260;

export function AnnouncementCard({ a, compact, children }: { a: AnnouncementView; compact?: boolean; children?: React.ReactNode }) {
  const long = a.body.length > LONG;
  return (
    <Card className={cn("p-4", a.pinned && "border-accent/40 bg-accent-soft/40")}>
      <div className="flex items-start gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", a.pinned ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2")}>
          {a.pinned ? <Pin className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <h3 className="font-semibold leading-snug">{a.title}</h3>
            {a.isExpired ? <span className="text-xs text-ink-3">(abgelaufen)</span> : null}
          </div>
          {compact || !long ? (
            <RichText text={compact && long ? a.body.slice(0, 160).trimEnd() + "…" : a.body} className={cn("mt-1 text-sm text-ink-2", compact && "line-clamp-3")} />
          ) : (
            <details className="group mt-1">
              <summary className="cursor-pointer list-none text-sm text-ink-2 [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">{a.body.slice(0, LONG).trimEnd()}… <span className="font-medium text-accent">Weiterlesen</span></span>
                <span className="hidden group-open:inline text-xs font-medium text-ink-3">Weniger anzeigen</span>
              </summary>
              <RichText text={a.body} className="mt-1 text-sm text-ink-2" />
            </details>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-ink-3">
            {a.authorName ? <Avatar name={a.authorName} src={a.authorAvatarUrl} size={20} tone="soft" /> : null}
            <span>{a.authorName ? `${a.authorName} · ` : ""}{formatDateZurich(a.createdAt, { weekday: undefined })}</span>
          </div>
          {children}
        </div>
      </div>
    </Card>
  );
}
