"use client";

import { confirmDialog, Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { isNavigationError, isNetworkError, toast } from "@/lib/ui-feedback";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, RotateCcw, X, XCircle } from "lucide-react";
import { cancelBookingAction, decideBookingAction, markBookingPaidAction, markBookingRefundedAction, payBookingAction } from "@/modules/bookings/actions";
import { Alert, Button, Field, Textarea } from "@/components/ui";

/** Meldung für geworfene Fehler (z.B. offline); redirect()/notFound() werden weitergereicht. */
function failureMessage(err: unknown) {
  if (isNavigationError(err)) throw err;
  return isNetworkError(err) ? "Keine Verbindung. Bitte versuche es nochmals, sobald du wieder online bist." : "Das hat nicht geklappt. Bitte nochmals versuchen.";
}

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div>
      <Button type="button" variant="ghost" size="sm" disabled={pending} className="text-ink-3"
        onClick={async () => { if ((await confirmDialog({ title: "Buchung wirklich stornieren?", tone: "danger", confirmLabel: "Stornieren", cancelLabel: "Behalten" }))) start(async () => {
          try {
            const r = await cancelBookingAction(bookingId);
            if (!r.ok) setErr(r.error);
            else { setErr(null); router.refresh(); }
          } catch (e) {
            setErr(failureMessage(e));
          }
        }); }}>
        <XCircle className="h-4 w-4" /> Stornieren
      </Button>
      {err ? <div className="mt-2"><Alert>{err}</Alert></div> : null}
    </div>
  );
}

export function PayNowButton({ bookingId }: { bookingId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <Button type="button" size="lg" className="w-full" disabled={pending} onClick={() => start(async () => {
        try {
          const r = await payBookingAction(bookingId);
          if (r && !r.ok) setErr(r.error);
        } catch (e) {
          setErr(failureMessage(e));
        }
      })}>
        <CreditCard className="h-5 w-5" /> {pending ? "Weiterleitung…" : "Jetzt bezahlen"}
      </Button>
      {err ? <div className="mt-2"><Alert>{err}</Alert></div> : null}
    </div>
  );
}

export function DecideButtons({ bookingId }: { bookingId: string }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const router = useRouter();
  const decide = (decision: "APPROVE" | "REJECT", reason?: string) =>
    start(async () => {
      let r: Awaited<ReturnType<typeof decideBookingAction>>;
      try {
        r = await decideBookingAction(bookingId, decision, reason);
      } catch (e) {
        toast.error(failureMessage(e));
        return;
      }
      if (!r.ok) toast.error(r.error);
      else {
        setRejecting(false);
        toast.success(r.message ?? (decision === "APPROVE" ? "Buchung freigegeben." : "Buchung abgelehnt."));
      }
      router.refresh();
    });
  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" disabled={pending} onClick={() => decide("APPROVE")}><Check className="h-4 w-4" /> Freigeben</Button>
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => { setNote(""); setRejecting(true); }}><X className="h-4 w-4" /> Ablehnen</Button>
      <Dialog
        open={rejecting}
        onClose={() => { if (!pending) setRejecting(false); }}
        title="Buchung ablehnen?"
        description="Das Mitglied sieht den Grund in seiner Reservation."
        dismissible={!pending}
        footer={
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setRejecting(false)}>Abbrechen</Button>
            <Button type="button" variant="danger" disabled={pending} onClick={() => decide("REJECT", note.trim() || undefined)}>{pending ? <Spinner /> : null} Ablehnen</Button>
          </div>
        }
      >
        <Field label="Grund (optional)">
          <Textarea name="rejectReason" rows={3} maxLength={191} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}

export function PaidToggle({ bookingId, paid }: { bookingId: string; paid: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
      try {
        const r = await markBookingPaidAction(bookingId, !paid);
        if (!r.ok) toast.error(r.error);
        router.refresh();
      } catch (e) {
        toast.error(failureMessage(e));
      }
    })}>
      {paid ? <><RotateCcw className="h-4 w-4" /> Als offen markieren</> : <><Check className="h-4 w-4" /> Als bezahlt markieren</>}
    </Button>
  );
}

export function RefundedButton({ bookingId }: { bookingId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
      try {
        const r = await markBookingRefundedAction(bookingId);
        if (r && !r.ok) toast.error(r.error);
        router.refresh();
      } catch (e) {
        toast.error(failureMessage(e));
      }
    })}>Als erstattet markieren</Button>
  );
}
