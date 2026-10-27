"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleHelp, Minus, Plus, X } from "lucide-react";
import { Alert, Button, Card, Input } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { rsvpAction } from "../actions";
import { MAX_GUESTS, RSVP_MY_LABELS, type RsvpStatus } from "../types";

type Props = {
  eventId: string;
  open: boolean;
  closedReason: string | null;
  mine: { status: RsvpStatus; guests: number; note: string | null } | null;
  capacity: number | null;
  seatsTaken: number;
  deadlineLabel: string | null;
};

const OPTIONS: Array<{ status: RsvpStatus; label: string; icon: React.ComponentType<{ className?: string }>; active: string }> = [
  { status: "YES", label: "Zusage", icon: Check, active: "bg-ok text-white border-ok" },
  { status: "MAYBE", label: "Vielleicht", icon: CircleHelp, active: "bg-warn text-white border-warn" },
  { status: "NO", label: "Absage", icon: X, active: "bg-ink text-bg border-ink" },
];

export function RsvpPanel({ eventId, open, closedReason, mine, capacity, seatsTaken, deadlineLabel }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<RsvpStatus | null>(null);
  const [status, setStatus] = useState<RsvpStatus | null>(mine?.status ?? null);
  const [guests, setGuests] = useState(mine?.guests ?? 0);
  const [note, setNote] = useState(mine?.note ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showExtras, setShowExtras] = useState(!!(mine && (mine.guests > 0 || mine.note)));

  // Plätze, die ohne meine eigene Zusage belegt sind
  const mySeats = mine?.status === "YES" ? 1 + mine.guests : 0;
  const freeForMe = capacity === null ? null : capacity - (seatsTaken - mySeats);
  const yesBlocked = freeForMe !== null && freeForMe < 1;

  function save(next: RsvpStatus) {
    setBusy(next);
    setMsg(null);
    start(async () => {
      const r = await rsvpAction({ eventId, status: next, guests: next === "NO" ? 0 : guests, note });
      setBusy(null);
      if (r.ok) {
        setStatus(next);
        setMsg({ ok: true, text: r.message ?? "Gespeichert." });
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  if (!open) {
    return (
      <Card className="p-4">
        <p className="text-sm font-medium">{status ? `Deine Antwort: ${RSVP_MY_LABELS[status]}` : "Anmeldung geschlossen"}</p>
        {closedReason ? <p className="mt-1 text-sm text-ink-3">{closedReason}</p> : null}
      </Card>
    );
  }

  return (
    <Card className="animate-rise p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{status ? RSVP_MY_LABELS[status] : "Bist du dabei?"}</h2>
        {deadlineLabel ? <span className="text-xs text-ink-3">Anmelden bis {deadlineLabel}</span> : null}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Deine Antwort">
        {OPTIONS.map((o) => {
          const active = status === o.status;
          const disabled = pending || (o.status === "YES" && yesBlocked && status !== "YES");
          return (
            <button key={o.status} type="button" disabled={disabled} aria-pressed={active} onClick={() => save(o.status)}
              className={cn("press flex h-16 flex-col items-center justify-center gap-1 rounded-control border text-sm font-semibold transition-colors disabled:opacity-45",
                active ? o.active : "border-line bg-surface text-ink hover:bg-surface-2")}>
              {busy === o.status ? <Spinner /> : <o.icon className="h-5 w-5" />}
              {o.label}
            </button>
          );
        })}
      </div>

      {yesBlocked && status !== "YES" ? (
        <p className="mt-3 text-sm text-warn">Ausgebucht. Wähle «Vielleicht», dann stehst du auf der Warteliste. Wird ein Platz frei, kannst du hier wieder zusagen.</p>
      ) : freeForMe !== null && freeForMe <= 5 && status !== "YES" ? (
        <p className="mt-3 text-sm text-ink-3">Nur noch {freeForMe} {freeForMe === 1 ? "Platz" : "Plätze"} frei.</p>
      ) : null}

      {status !== "NO" ? (
        showExtras ? (
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Begleitpersonen</p>
                <p className="text-xs text-ink-3">Gäste, die du mitbringst</p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" className="h-11 w-11 px-0" aria-label="Weniger" disabled={guests <= 0} onClick={() => setGuests((g) => Math.max(0, g - 1))}><Minus className="h-4 w-4" /></Button>
                <span className="w-6 text-center text-lg font-semibold tabular-nums" aria-live="polite">{guests}</span>
                <Button type="button" variant="secondary" size="sm" className="h-11 w-11 px-0" aria-label="Mehr" disabled={guests >= MAX_GUESTS} onClick={() => setGuests((g) => Math.min(MAX_GUESTS, g + 1))}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div>
              <label htmlFor={`note-${eventId}`} className="text-sm font-medium">Bemerkung (optional)</label>
              <Input id={`note-${eventId}`} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="z.B. komme etwas später" className="mt-1" />
              <p className="mt-1 text-xs text-ink-3">Sichtbar für die Verantwortlichen.</p>
            </div>
            <Button type="button" className="w-full" disabled={pending} onClick={() => save(status ?? "YES")}>
              {pending ? <Spinner /> : null} {status ? "Änderungen speichern" : "Zusagen"}
            </Button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowExtras(true)} className="mt-3 text-sm font-medium text-ink-2 underline underline-offset-2 hover:text-ink">
            + Begleitpersonen oder Bemerkung
          </button>
        )
      ) : null}

      {msg ? <div className="mt-3"><Alert tone={msg.ok ? "ok" : "error"}>{msg.text}</Alert></div> : null}
    </Card>
  );
}
