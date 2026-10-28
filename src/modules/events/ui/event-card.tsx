import Link from "next/link";
import { Ban, Check, CircleHelp, Clock, MapPin, Users, X } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { EventListItem } from "../queries";
import { whenLabel } from "../types";
import { DateBadge, KindChip } from "./bits";

export function MyRsvpBadge({ status, open }: { status: EventListItem["myStatus"]; open: boolean }) {
  if (status === "YES") return <span className="inline-flex items-center gap-1 rounded-full bg-ok/12 px-2 py-0.5 text-xs font-semibold text-ok"><Check className="h-3.5 w-3.5" /> Dabei</span>;
  if (status === "MAYBE") return <span className="inline-flex items-center gap-1 rounded-full bg-warn/12 px-2 py-0.5 text-xs font-semibold text-warn"><CircleHelp className="h-3.5 w-3.5" /> Vielleicht</span>;
  if (status === "NO") return <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-3"><X className="h-3.5 w-3.5" /> Abgemeldet</span>;
  if (open) return <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">Antwort offen</span>;
  return null;
}

export function EventCard({ e, href }: { e: EventListItem; href?: string }) {
  const seats = e.counts.yes + e.counts.yesGuests;
  const full = e.capacity !== null && seats >= e.capacity;
  return (
    <Link href={href ?? `/events/${e.id}`} className="block press focus-visible:outline-2 focus-visible:outline-accent rounded-card">
      <Card className={cn("flex gap-3 p-3 hover:border-ink/25 transition-colors", e.isCancelled && "opacity-70")}>
        <DateBadge date={e.startsAt} muted={e.isPast || e.isCancelled} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindChip kind={e.kind} />
            {e.isCancelled ? <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-white"><Ban className="h-3.5 w-3.5" /> Abgesagt</span> : null}
            {!e.isCancelled && e.rsvpEnabled && !e.isPast ? <MyRsvpBadge status={e.myStatus} open={e.rsvpOpen} /> : null}
          </div>
          <h3 className={cn("mt-1 font-semibold leading-snug", e.isCancelled && "line-through decoration-1")}>{e.title}</h3>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-ink-3">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{whenLabel(e)}</span>
            {e.location ? <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{e.location}</span></span> : null}
          </div>
          {e.rsvpEnabled && !e.isCancelled ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-3">
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /><span className="font-medium text-ink-2">{seats}</span>{e.capacity ? ` / ${e.capacity}` : ""} dabei</span>
              {e.counts.maybe ? <span>{e.counts.maybe} vielleicht</span> : null}
              {full && !e.isPast ? <span className="font-semibold text-warn">Ausgebucht</span> : null}
            </div>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
