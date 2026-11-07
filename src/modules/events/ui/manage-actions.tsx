"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CopyPlus, FileDown, Pencil, Pin, PinOff, RotateCcw, Trash2 } from "lucide-react";
import { Alert, Button, buttonClasses } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";
import { isNavigationError, isNetworkError } from "@/lib/ui-feedback";
import { useT } from "@/components/locale";
import { deleteAnnouncementAction, deleteEventAction, setEventCancelledAction, toggleAnnouncementPinAction } from "../actions";

function useRun() {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>, after?: () => void) => {
    setErr(null);
    start(async () => {
      let r: ActionResult;
      try {
        r = await fn();
      } catch (e) {
        if (isNavigationError(e)) throw e;
        setErr(t(isNetworkError(e) ? "bookings.common.offline" : "bookings.common.failed"));
        return;
      }
      if (!r.ok) setErr(r.error);
      else if (after) after();
      else router.refresh();
    });
  };
  return { pending, err, run, router, t };
}

/** Werkzeugleiste für Verantwortliche auf der Detailseite. */
export function EventManageBar({ eventId, isCancelled, rsvpEnabled }: { eventId: string; isCancelled: boolean; rsvpEnabled: boolean }) {
  const { pending, err, run, router, t } = useRun();
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Link href={`/admin/events/${eventId}/edit`} className={buttonClasses("secondary", "md")}><Pencil className="h-4 w-4" /> {t("misc.events.edit")}</Link>
        <Link href={`/admin/events/new?copy=${eventId}`} className={buttonClasses("secondary", "md")}><CopyPlus className="h-4 w-4" /> {t("misc.events.duplicate")}</Link>
        {rsvpEnabled ? <a href={`/api/export/events/${eventId}`} className={buttonClasses("secondary", "md")}><FileDown className="h-4 w-4" /> {t("misc.events.listCsv")}</a> : null}
        {isCancelled ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => setEventCancelledAction(eventId, false))}><RotateCcw className="h-4 w-4" /> {t("misc.events.reinstate")}</Button>
        ) : (
          <Button type="button" variant="secondary" disabled={pending}
            onClick={async () => { if ((await confirmDialog({ title: t("misc.events.cancelTitle"), message: t("misc.events.cancelText"), tone: "danger", confirmLabel: t("misc.events.cancel"), cancelLabel: t("misc.events.back") }))) run(() => setEventCancelledAction(eventId, true)); }}>
            <Ban className="h-4 w-4" /> {t("misc.events.cancel")}
          </Button>
        )}
        <Button type="button" variant="ghost" disabled={pending} className="text-accent"
          onClick={async () => { if ((await confirmDialog({ title: t("misc.events.deleteTitle"), message: t("misc.events.deleteText"), tone: "danger", confirmLabel: t("misc.events.delete"), cancelLabel: t("misc.events.back") }))) run(() => deleteEventAction(eventId), () => router.push("/events")); }}>
          <Trash2 className="h-4 w-4" /> {t("misc.events.delete")}
        </Button>
      </div>
      {err ? <div className="mt-2"><Alert>{err}</Alert></div> : null}
    </div>
  );
}

/** Kompakte Aktionen in der Verwaltungsliste. */
export function EventRowActions({ eventId, isCancelled }: { eventId: string; isCancelled: boolean }) {
  const { pending, err, run, t } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link href={`/admin/events/${eventId}/edit`} className={buttonClasses("ghost", "sm")} aria-label={t("misc.events.edit")}><Pencil className="h-4 w-4" /><span className="hidden sm:inline">{t("misc.events.edit")}</span></Link>
      <Link href={`/admin/events/new?copy=${eventId}`} className={buttonClasses("ghost", "sm")} aria-label={t("misc.events.duplicate")}><CopyPlus className="h-4 w-4" /><span className="hidden sm:inline">{t("misc.events.duplicate")}</span></Link>
      {isCancelled ? (
        <Button type="button" variant="ghost" size="sm" disabled={pending} aria-label={t("misc.events.reinstate")} onClick={() => run(() => setEventCancelledAction(eventId, false))}><RotateCcw className="h-4 w-4" /></Button>
      ) : (
        <Button type="button" variant="ghost" size="sm" disabled={pending} aria-label={t("misc.events.cancel")} onClick={async () => { if ((await confirmDialog({ title: t("misc.events.cancelTitle"), tone: "danger", confirmLabel: t("misc.events.cancel"), cancelLabel: t("misc.events.back") }))) run(() => setEventCancelledAction(eventId, true)); }}><Ban className="h-4 w-4" /></Button>
      )}
      <Button type="button" variant="ghost" size="sm" disabled={pending} aria-label={t("misc.events.delete")} className="text-accent"
        onClick={async () => { if ((await confirmDialog({ title: t("misc.events.deleteTitle"), tone: "danger", confirmLabel: t("misc.events.delete"), cancelLabel: t("misc.events.back") }))) run(() => deleteEventAction(eventId)); }}><Trash2 className="h-4 w-4" /></Button>
      {err ? <span className="w-full text-xs text-accent">{err}</span> : null}
    </div>
  );
}

export function AnnouncementRowActions({ id, pinned }: { id: string; pinned: boolean }) {
  const { pending, err, run, t } = useRun();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-2">
      <Link href={`/admin/events/announcements/${id}`} className={buttonClasses("ghost", "sm")}><Pencil className="h-4 w-4" /> {t("misc.events.edit")}</Link>
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => toggleAnnouncementPinAction(id))}>
        {pinned ? <><PinOff className="h-4 w-4" /> {t("misc.events.unpin")}</> : <><Pin className="h-4 w-4" /> {t("misc.events.pin")}</>}
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={pending} className="text-accent" onClick={async () => { if ((await confirmDialog({ title: t("misc.events.annDeleteTitle"), tone: "danger", confirmLabel: t("misc.events.delete"), cancelLabel: t("misc.events.back") }))) run(() => deleteAnnouncementAction(id)); }}>
        <Trash2 className="h-4 w-4" /> {t("misc.events.delete")}
      </Button>
      {err ? <span className="w-full text-xs text-accent">{err}</span> : null}
    </div>
  );
}
