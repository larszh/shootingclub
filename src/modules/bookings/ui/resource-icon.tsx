import { Building2, Crosshair, DoorOpen, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

/** Rundes Symbol je Ressourcen-Art (Stand, Bahn, Raum, Anderes). */
export function ResourceIcon({ kind, size = 44, className }: { kind: string; size?: number; className?: string }) {
  const Icon = kind === "RANGE" ? Building2 : kind === "LANE" ? Crosshair : kind === "ROOM" ? DoorOpen : MapPin;
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent", className)} style={{ width: size, height: size }} aria-hidden>
      <Icon style={{ width: Math.round(size * 0.46), height: Math.round(size * 0.46) }} />
    </span>
  );
}
