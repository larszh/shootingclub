"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hourglass } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Button, Card } from "@/components/ui";
import { confirmDialog } from "@/components/ui/dialog";
import { toast } from "@/lib/ui-feedback";
import { getT, type Locale } from "@/lib/i18n/core";
import { withdrawJoinRequestAction } from "@/modules/core/join-requests";

export type PendingRequest = { id: string; clubName: string; city: string | null; logoUrl: string | null; since: string };

/** Warteseite: offene Beitrittsanfragen (Membership PENDING) mit Rückzug. */
export function PendingJoinRequests({ requests, locale }: { requests: PendingRequest[]; locale: Locale }) {
  const t = getT(locale);
  return (
    <div className="stagger mb-6 space-y-2.5">
      {requests.map((r) => <RequestCard key={r.id} r={r} locale={locale} />)}
      <p className="px-1 text-xs text-ink-3">{t("bookings.join.waiting.hint")}</p>
    </div>
  );
}

function RequestCard({ r, locale }: { r: PendingRequest; locale: Locale }) {
  const t = getT(locale);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Avatar name={r.clubName} src={r.logoUrl} size={44} tone="soft" className="rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{r.clubName}{r.city ? <span className="font-normal text-ink-3"> · {r.city}</span> : null}</p>
          <p className="inline-flex items-center gap-1.5 text-sm text-warn"><Hourglass className="h-3.5 w-3.5" aria-hidden /> {t("bookings.join.waiting.status")}</p>
          <p className="text-xs text-ink-3">{t("bookings.join.waiting.since", { date: r.since })}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="button" variant="ghost" size="sm" className="min-h-11 text-ink-3" disabled={pending} onClick={async () => {
          const yes = await confirmDialog({ title: t("bookings.join.withdraw.confirm", { club: r.clubName }), tone: "danger", confirmLabel: t("bookings.join.withdraw.button"), cancelLabel: t("bookings.common.keep") });
          if (!yes) return;
          start(async () => {
            const res = await withdrawJoinRequestAction(r.id).catch(() => null);
            if (!res || !res.ok) toast.error(res && !res.ok ? res.error : t("bookings.common.failed"));
            else toast.success(t("bookings.join.withdraw.done"));
            router.refresh();
          });
        }}>{t("bookings.join.withdraw.button")}</Button>
      </div>
    </Card>
  );
}
