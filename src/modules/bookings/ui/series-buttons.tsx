"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { confirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui";
import { isNavigationError, isNetworkError, toast } from "@/lib/ui-feedback";
import { cancelSeriesAction, cancelSeriesOccurrenceAction } from "@/modules/bookings/series-actions";

function failureMessage(err: unknown) {
  if (isNavigationError(err)) throw err;
  return isNetworkError(err) ? "Keine Verbindung. Bitte versuche es nochmals, sobald du wieder online bist." : "Das hat nicht geklappt. Bitte nochmals versuchen.";
}

export function CancelSeriesButton({ seriesId, upcoming }: { seriesId: string; upcoming: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" variant="secondary" disabled={pending} className="w-full sm:w-auto" onClick={async () => {
      const yes = await confirmDialog({
        title: "Ganze Serie stornieren?",
        message: upcoming === 1 ? "Der künftige Termin wird storniert. Vergangene Termine bleiben im Verlauf." : `Alle ${upcoming} künftigen Termine werden storniert. Vergangene Termine bleiben im Verlauf.`,
        tone: "danger", confirmLabel: "Serie stornieren", cancelLabel: "Behalten",
      });
      if (!yes) return;
      start(async () => {
        try {
          const r = await cancelSeriesAction(seriesId);
          if (!r.ok) toast.error(r.error);
          else toast.success(r.message ?? "Serie storniert.");
        } catch (e) {
          toast.error(failureMessage(e));
        }
        router.refresh();
      });
    }}>
      <XCircle className="h-4 w-4" /> Ganze Serie stornieren
    </Button>
  );
}

export function CancelOccurrenceButton({ bookingId, label }: { bookingId: string; label: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} className="text-ink-3 min-h-11" aria-label={`Termin ${label} stornieren`} onClick={async () => {
      const yes = await confirmDialog({ title: `Termin ${label} stornieren?`, tone: "danger", confirmLabel: "Stornieren", cancelLabel: "Behalten" });
      if (!yes) return;
      start(async () => {
        try {
          const r = await cancelSeriesOccurrenceAction(bookingId);
          if (!r.ok) toast.error(r.error);
          else toast.success(r.message ?? "Termin storniert.");
        } catch (e) {
          toast.error(failureMessage(e));
        }
        router.refresh();
      });
    }}>
      <XCircle className="h-4 w-4" /> Stornieren
    </Button>
  );
}
