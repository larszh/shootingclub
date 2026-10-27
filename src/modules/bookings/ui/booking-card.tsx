import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { BOOKING_STATUS, PAYMENT_STATUS } from "@/modules/bookings/types";
import { formatDateZurich, formatTimeRange } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import type { BookingRow } from "@/modules/bookings/queries";

export function BookingCard({ b, showUser }: { b: BookingRow; showUser?: boolean }) {
  const st = BOOKING_STATUS[b.status] ?? { label: b.status, tone: "neutral" as const };
  const ps = PAYMENT_STATUS[b.paymentStatus] ?? { label: b.paymentStatus, tone: "neutral" as const };
  return (
    <Link href={`/bookings/${b.id}`} className="block press">
      <Card className="p-4 hover:border-ink/30 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium truncate">{b.resource.name}{showUser && b.user ? <span className="text-ink-3 font-normal"> · {b.user.name}</span> : null}</div>
            <div className="text-xs text-ink-3">{formatDateZurich(b.startsAt)} · {formatTimeRange(b.startsAt, b.endsAt)}</div>
            <div className="mt-1.5 flex flex-wrap gap-1"><Badge tone={st.tone}>{st.label}</Badge>{b.totalCents > 0 ? <Badge tone={ps.tone}>{ps.label}</Badge> : null}</div>
          </div>
          <div className="text-right shrink-0 text-lg font-semibold tabular-nums">{b.totalCents ? formatMoney(b.totalCents, b.currency) : "gratis"}</div>
        </div>
      </Card>
    </Link>
  );
}
