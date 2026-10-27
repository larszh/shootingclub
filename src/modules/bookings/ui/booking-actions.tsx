"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, RotateCcw, X, XCircle } from "lucide-react";
import { cancelBookingAction, decideBookingAction, markBookingPaidAction, markBookingRefundedAction, payBookingAction } from "@/modules/bookings/actions";
import { Alert, Button } from "@/components/ui";

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div>
      <Button type="button" variant="ghost" size="sm" disabled={pending} className="text-ink-3"
        onClick={async () => { if ((await confirmDialog({ title: "Buchung wirklich stornieren?", tone: "danger" }))) start(async () => { const r = await cancelBookingAction(bookingId); if (!r.ok) setErr(r.error); else router.refresh(); }); }}>
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
      <Button type="button" size="lg" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await payBookingAction(bookingId); if (r && !r.ok) setErr(r.error); })}>
        <CreditCard className="h-5 w-5" /> {pending ? "Weiterleitung…" : "Jetzt bezahlen"}
      </Button>
      {err ? <div className="mt-2"><Alert>{err}</Alert></div> : null}
    </div>
  );
}

export function DecideButtons({ bookingId }: { bookingId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" disabled={pending} onClick={() => start(async () => { await decideBookingAction(bookingId, "APPROVE"); router.refresh(); })}><Check className="h-4 w-4" /> Freigeben</Button>
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => { const note = prompt("Grund (optional):") ?? undefined; start(async () => { await decideBookingAction(bookingId, "REJECT", note); router.refresh(); }); }}><X className="h-4 w-4" /> Ablehnen</Button>
    </div>
  );
}

export function PaidToggle({ bookingId, paid }: { bookingId: string; paid: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { await markBookingPaidAction(bookingId, !paid); router.refresh(); })}>
      {paid ? <><RotateCcw className="h-4 w-4" /> Als offen markieren</> : <><Check className="h-4 w-4" /> Als bezahlt markieren</>}
    </Button>
  );
}

export function RefundedButton({ bookingId }: { bookingId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { await markBookingRefundedAction(bookingId); router.refresh(); })}>Als erstattet markieren</Button>
  );
}
