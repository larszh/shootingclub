"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CopyPlus, FileDown, Pencil, Pin, PinOff, RotateCcw, Trash2 } from "lucide-react";
import { Alert, Button, buttonClasses } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";
import { deleteAnnouncementAction, deleteEventAction, setEventCancelledAction, toggleAnnouncementPinAction } from "../actions";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>, after?: () => void) => {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setErr(r.error);
      else if (after) after();
      else router.refresh();
    });
  };
  return { pending, err, run, router };
}

/** Werkzeugleiste für Verantwortliche auf der Detailseite. */
export function EventManageBar({ eventId, isCancelled, rsvpEnabled }: { eventId: string; isCancelled: boolean; rsvpEnabled: boolean }) {
  const { pending, err, run, router } = useRun();
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Link href={`/admin/events/${eventId}/edit`} className={buttonClasses("secondary", "md")}><Pencil className="h-4 w-4" /> Bearbeiten</Link>
        <Link href={`/admin/events/new?copy=${eventId}`} className={buttonClasses("secondary", "md")}><CopyPlus className="h-4 w-4" /> Duplizieren</Link>
        {rsvpEnabled ? <a href={`/api/export/events/${eventId}`} className={buttonClasses("secondary", "md")}><FileDown className="h-4 w-4" /> Liste (CSV)</a> : null}
        {isCancelled ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => setEventCancelledAction(eventId, false))}><RotateCcw className="h-4 w-4" /> Wieder ansetzen</Button>
        ) : (
          <Button type="button" variant="secondary" disabled={pending}
            onClick={async () => { if ((await confirmDialog({ title: "Anlass absagen? Er bleibt sichtbar und wird als «Abgesagt» markiert.", tone: "danger" }))) run(() => setEventCancelledAction(eventId, true)); }}>
            <Ban className="h-4 w-4" /> Absagen
          </Button>
        )}
        <Button type="button" variant="ghost" disabled={pending} className="text-accent"
          onClick={async () => { if ((await confirmDialog({ title: "Anlass endgültig löschen? Alle An- und Abmeldungen gehen verloren.", tone: "danger" }))) run(() => deleteEventAction(eventId), () => router.push("/events")); }}>
          <Trash2 className="h-4 w-4" /> Löschen
        </Button>
      </div>
      {err ? <div className="mt-2"><Alert>{err}</Alert></div> : null}
    </div>
  );
}

/** Kompakte Aktionen in der Verwaltungsliste. */
export function EventRowActions({ eventId, isCancelled }: { eventId: string; isCancelled: boolean }) {
  const { pending, err, run } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link href={`/admin/events/${eventId}/edit`} className={buttonClasses("ghost", "sm")} aria-label="Bearbeiten"><Pencil className="h-4 w-4" /><span className="hidden sm:inline">Bearbeiten</span></Link>
      <Link href={`/admin/events/new?copy=${eventId}`} className={buttonClasses("ghost", "sm")} aria-label="Duplizieren"><CopyPlus className="h-4 w-4" /><span className="hidden sm:inline">Duplizieren</span></Link>
      {isCancelled ? (
        <Button type="button" variant="ghost" size="sm" disabled={pending} aria-label="Wieder ansetzen" onClick={() => run(() => setEventCancelledAction(eventId, false))}><RotateCcw className="h-4 w-4" /></Button>
      ) : (
        <Button type="button" variant="ghost" size="sm" disabled={pending} aria-label="Absagen" onClick={async () => { if ((await confirmDialog({ title: "Anlass absagen?", tone: "danger" }))) run(() => setEventCancelledAction(eventId, true)); }}><Ban className="h-4 w-4" /></Button>
      )}
      <Button type="button" variant="ghost" size="sm" disabled={pending} aria-label="Löschen" className="text-accent"
        onClick={async () => { if ((await confirmDialog({ title: "Anlass endgültig löschen?", tone: "danger" }))) run(() => deleteEventAction(eventId)); }}><Trash2 className="h-4 w-4" /></Button>
      {err ? <span className="w-full text-xs text-accent">{err}</span> : null}
    </div>
  );
}

export function AnnouncementRowActions({ id, pinned }: { id: string; pinned: boolean }) {
  const { pending, err, run } = useRun();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-2">
      <Link href={`/admin/events/announcements/${id}`} className={buttonClasses("ghost", "sm")}><Pencil className="h-4 w-4" /> Bearbeiten</Link>
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => toggleAnnouncementPinAction(id))}>
        {pinned ? <><PinOff className="h-4 w-4" /> Nicht mehr anheften</> : <><Pin className="h-4 w-4" /> Anheften</>}
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={pending} className="text-accent" onClick={async () => { if ((await confirmDialog({ title: "Mitteilung löschen?", tone: "danger" }))) run(() => deleteAnnouncementAction(id)); }}>
        <Trash2 className="h-4 w-4" /> Löschen
      </Button>
      {err ? <span className="w-full text-xs text-accent">{err}</span> : null}
    </div>
  );
}
