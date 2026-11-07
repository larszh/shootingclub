"use client";

import { confirmDialog, Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { isNavigationError, isNetworkError, toast } from "@/lib/ui-feedback";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, RotateCcw, X, XCircle } from "lucide-react";
import { cancelBookingAction, decideBookingAction, markBookingPaidAction, markBookingRefundedAction, payBookingAction } from "@/modules/bookings/actions";
import { Alert, Button, Field, Textarea } from "@/components/ui";
import { getT, type Locale, type TFunction } from "@/lib/i18n/core";
import { useT } from "@/components/locale";

/** Meldung für geworfene Fehler (z.B. offline); redirect()/notFound() werden weitergereicht. */
function failureMessage(err: unknown, t: TFunction = getT("de")) {
  if (isNavigationError(err)) throw err;
  return isNetworkError(err) ? t("bookings.common.offline") : t("bookings.common.failed");
}

export function CancelBookingButton({ bookingId, locale = "de" }: { bookingId: string; locale?: Locale }) {
  const t = getT(locale);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div>
      <Button type="button" variant="ghost" size="sm" disabled={pending} className="text-ink-3"
        onClick={async () => { if ((await confirmDialog({ title: t("bookings.cancel.confirm"), tone: "danger", confirmLabel: t("bookings.cancel.button"), cancelLabel: t("bookings.common.keep") }))) start(async () => {
          try {
            const r = await cancelBookingAction(bookingId);
            if (!r.ok) setErr(r.error);
            else { setErr(null); router.refresh(); }
          } catch (e) {
            setErr(failureMessage(e, t));
          }
        }); }}>
        <XCircle className="h-4 w-4" /> {t("bookings.cancel.button")}
      </Button>
      {err ? <div className="mt-2"><Alert>{err}</Alert></div> : null}
    </div>
  );
}

export function PayNowButton({ bookingId, locale = "de" }: { bookingId: string; locale?: Locale }) {
  const t = getT(locale);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <Button type="button" size="lg" className="w-full" disabled={pending} onClick={() => start(async () => {
        try {
          const r = await payBookingAction(bookingId);
          if (r && !r.ok) setErr(r.error);
        } catch (e) {
          setErr(failureMessage(e, t));
        }
      })}>
        <CreditCard className="h-5 w-5" /> {pending ? t("bookings.pay.redirecting") : t("bookings.pay.now")}
      </Button>
      {err ? <div className="mt-2"><Alert>{err}</Alert></div> : null}
    </div>
  );
}

export function DecideButtons({ bookingId }: { bookingId: string }) {
  const t = useT();
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
        toast.error(failureMessage(e, t));
        return;
      }
      if (!r.ok) toast.error(r.error);
      else {
        setRejecting(false);
        toast.success(t(decision === "APPROVE" ? "adm1.bk.decide.approved" : "adm1.bk.decide.rejected"));
      }
      router.refresh();
    });
  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" disabled={pending} onClick={() => decide("APPROVE")}><Check className="h-4 w-4" /> {t("adm1.bk.decide.approve")}</Button>
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => { setNote(""); setRejecting(true); }}><X className="h-4 w-4" /> {t("adm1.bk.decide.reject")}</Button>
      <Dialog
        open={rejecting}
        onClose={() => { if (!pending) setRejecting(false); }}
        title={t("adm1.bk.decide.rejectTitle")}
        description={t("adm1.bk.decide.rejectText")}
        dismissible={!pending}
        footer={
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setRejecting(false)}>{t("bookings.common.cancel")}</Button>
            <Button type="button" variant="danger" disabled={pending} onClick={() => decide("REJECT", note.trim() || undefined)}>{pending ? <Spinner /> : null} {t("adm1.bk.decide.reject")}</Button>
          </div>
        }
      >
        <Field label={t("adm1.bk.decide.reason")}>
          <Textarea name="rejectReason" rows={3} maxLength={191} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}

export function PaidToggle({ bookingId, paid }: { bookingId: string; paid: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
      try {
        const r = await markBookingPaidAction(bookingId, !paid);
        if (!r.ok) toast.error(r.error);
        router.refresh();
      } catch (e) {
        toast.error(failureMessage(e, t));
      }
    })}>
      {paid ? <><RotateCcw className="h-4 w-4" /> {t("adm1.bk.paid.markOpen")}</> : <><Check className="h-4 w-4" /> {t("adm1.bk.paid.markPaid")}</>}
    </Button>
  );
}

export function RefundedButton({ bookingId }: { bookingId: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
      try {
        const r = await markBookingRefundedAction(bookingId);
        if (r && !r.ok) toast.error(r.error);
        router.refresh();
      } catch (e) {
        toast.error(failureMessage(e, t));
      }
    })}>{t("adm1.bk.paid.markRefunded")}</Button>
  );
}
