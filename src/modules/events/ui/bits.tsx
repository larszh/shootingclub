import { CalendarDays, Hammer, PartyPopper, ShieldCheck, Target, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateBadge, kindMeta, linkify, type EventKind } from "../types";

const KIND_ICONS: Record<EventKind, React.ComponentType<{ className?: string }>> = {
  TRAINING: Target,
  COMPETITION: Trophy,
  OBLIGATORY: ShieldCheck,
  MEETING: Users,
  SOCIAL: PartyPopper,
  WORK: Hammer,
  OTHER: CalendarDays,
};

export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = KIND_ICONS[kind as EventKind] ?? CalendarDays;
  return <Icon className={className} />;
}

export function KindChip({ kind, className }: { kind: string; className?: string }) {
  const meta = kindMeta(kind);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", meta.chip, className)}>
      <KindIcon kind={kind} className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

/** Kalenderblatt mit Tag, Monat und Wochentag (Schweizer Zeit). */
export function DateBadge({ date, muted, size = "md" }: { date: Date; muted?: boolean; size?: "md" | "lg" }) {
  const b = dateBadge(date);
  return (
    <div className={cn("flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-control border text-center leading-none",
      size === "lg" ? "h-18 w-16" : "h-15 w-13",
      muted ? "border-line bg-surface-2 text-ink-3" : "border-line bg-surface text-ink")}>
      <span className={cn("w-full py-0.5 text-[10px] font-semibold uppercase tracking-wide", muted ? "bg-ink-3/20 text-ink-2" : "bg-accent text-accent-ink")}>{b.month}</span>
      <span className={cn("font-semibold tabular-nums", size === "lg" ? "mt-1 text-2xl" : "mt-0.5 text-xl")}>{b.day}</span>
      <span className="text-[10px] text-ink-3 mt-0.5 mb-1">{b.weekday}</span>
    </div>
  );
}

/** Text mit Zeilenumbrüchen und klickbaren Links – ohne HTML-Interpretation. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const segments = linkify(text);
  return (
    <p className={cn("whitespace-pre-line break-words", className)}>
      {segments.map((s, i) =>
        s.type === "link" ? (
          <a key={i} href={s.href} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline underline-offset-2 break-all">{s.value}</a>
        ) : (
          <span key={i}>{s.value}</span>
        ),
      )}
    </p>
  );
}
