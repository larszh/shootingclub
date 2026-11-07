"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { confirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui";
import { isNavigationError, isNetworkError, toast } from "@/lib/ui-feedback";
import { cancelSeriesAction, cancelSeriesOccurrenceAction } from "@/modules/bookings/series-actions";
import { seriesErrorLabel } from "@/modules/bookings/i18n";
import { useT } from "@/components/locale";
import type { TFunction } from "@/lib/i18n/core";

function failureMessage(err: unknown, t: TFunction) {
  if (isNavigationError(err)) throw err;
  return t(isNetworkError(err) ? "bookings.common.offline" : "bookings.common.failed");
}

export function CancelSeriesButton({ seriesId, upcoming }: { seriesId: string; upcoming: number }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" variant="secondary" disabled={pending} className="w-full sm:w-auto" onClick={async () => {
      const yes = await confirmDialog({
        title: t("bookings.series.cancelAllTitle"),
        message: t(upcoming === 1 ? "bookings.series.cancelAllText.one" : "bookings.series.cancelAllText.other", { n: upcoming }),
        tone: "danger", confirmLabel: t("bookings.series.cancelConfirm"), cancelLabel: t("bookings.common.keep"),
      });
      if (!yes) return;
      start(async () => {
        try {
          const r = await cancelSeriesAction(seriesId);
          if (!r.ok) toast.error(seriesErrorLabel(r.error, t));
          else toast.success(t("bookings.series.cancelled"));
        } catch (e) {
          toast.error(failureMessage(e, t));
        }
        router.refresh();
      });
    }}>
      <XCircle className="h-4 w-4" /> {t("bookings.series.cancelAll")}
    </Button>
  );
}

export function CancelOccurrenceButton({ bookingId, label }: { bookingId: string; label: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} className="text-ink-3 min-h-11" aria-label={t("bookings.series.cancelOne", { date: label })} onClick={async () => {
      const yes = await confirmDialog({ title: t("bookings.series.cancelOneTitle", { date: label }), tone: "danger", confirmLabel: t("bookings.series.cancelShort"), cancelLabel: t("bookings.common.keep") });
      if (!yes) return;
      start(async () => {
        try {
          const r = await cancelSeriesOccurrenceAction(bookingId);
          if (!r.ok) toast.error(seriesErrorLabel(r.error, t));
          else toast.success(t("bookings.series.occurrenceCancelled"));
        } catch (e) {
          toast.error(failureMessage(e, t));
        }
        router.refresh();
      });
    }}>
      <XCircle className="h-4 w-4" /> {t("bookings.series.cancelShort")}
    </Button>
  );
}
