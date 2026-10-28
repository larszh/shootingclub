import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { Avatar, userAvatarUrl } from "@/components/avatar";
import { BOOKING_STATUS, paymentStatusView } from "@/modules/bookings/types";
import { formatDateZurich, formatTimeRange } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import type { BookingRow } from "@/modules/bookings/queries";
import { ResourceIcon } from "./resource-icon";

export function BookingCard({ b, showUser }: { b: BookingRow; showUser?: boolean }) {
  const st = BOOKING_STATUS[b.status] ?? { label: b.status, tone: "neutral" as const };
  const ps = paymentStatusView(b);
  const inactive = b.status === "CANCELLED" || b.status === "REJECTED";
  return (
    <Link href={`/bookings/${b.id}`} className="block press">
      <Card className={`p-3.5 hover:border-ink/30 transition-colors ${inactive ? "opacity-70" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <ResourceIcon kind={b.resource.kind} />
            {showUser && b.user ? (
              <span className="absolute -bottom-1 -right-1 rounded-full ring-2 ring-surface">
                <Avatar name={b.user.name} src={userAvatarUrl(b.user)} size={22} />
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{b.resource.name}{showUser && b.user ? <span className="text-ink-3 font-normal"> · {b.user.name}</span> : null}</div>
            <div className="text-xs text-ink-3">{formatDateZurich(b.startsAt)} · <span className="tabular-nums">{formatTimeRange(b.startsAt, b.endsAt)}</span></div>
            <div className="mt-1.5 flex flex-wrap gap-1"><Badge tone={st.tone}>{st.label}</Badge>{b.totalCents > 0 && !ps.void ? <Badge tone={ps.tone}>{ps.label}</Badge> : null}</div>
          </div>
          <div className="text-right shrink-0 text-base font-semibold tabular-nums">{b.totalCents ? formatMoney(b.totalCents, b.currency) : "gratis"}</div>
        </div>
      </Card>
    </Link>
  );
}
