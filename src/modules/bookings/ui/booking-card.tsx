import Link from "next/link";
import { Repeat } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { Avatar, userAvatarUrl } from "@/components/avatar";
import { getT, type Locale } from "@/lib/i18n/core";
import { formatMoney } from "@/lib/money";
import type { BookingRow } from "@/modules/bookings/queries";
import { personsSuffix } from "@/modules/bookings/pricing";
import { bookingStatusView, formatDateL, formatTimeRangeL, paymentStatusViewT } from "@/modules/bookings/i18n";
import { ResourceIcon } from "./resource-icon";

/**
 * Karte einer Buchung. `partner`: Abzeichen für gemeinsame Anlagen, z.B. «Partner: SG Muster» in der
 * Verwaltung des Eigentümers oder «Anlage von SV Beispiel» beim Mitglied des Partnervereins.
 * `locale`: Sprache der Seite (Standard Deutsch, z.B. in der Verwaltung). Termine einer Serie
 * erhalten das Abzeichen «Serie».
 */
export function BookingCard({ b, showUser, partner, locale = "de" }: {
  b: Pick<BookingRow, "id" | "status" | "paymentStatus" | "persons" | "isFlatRate" | "resource" | "user" | "startsAt" | "endsAt" | "totalCents" | "currency"> & { seriesId?: string | null };
  showUser?: boolean; partner?: string | null; locale?: Locale;
}) {
  const t = getT(locale);
  const st = bookingStatusView(b.status, t);
  const ps = paymentStatusViewT(b, t);
  const inactive = b.status === "CANCELLED" || b.status === "REJECTED";
  const persons = personsSuffix(b, t);
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
            <div className="text-xs text-ink-3">{formatDateL(b.startsAt, locale)} · <span className="tabular-nums">{formatTimeRangeL(b.startsAt, b.endsAt, locale)}</span>{persons ? ` · ${persons}` : ""}</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Badge tone={st.tone}>{st.label}</Badge>
              {b.totalCents > 0 && !ps.void ? <Badge tone={ps.tone}>{ps.label}</Badge> : null}
              {b.seriesId ? <Badge tone="outline"><Repeat className="mr-1 inline h-3 w-3" aria-hidden />{t("bookings.series.badge")}</Badge> : null}
              {partner ? <Badge tone="outline" className="max-w-full truncate">{partner}</Badge> : null}
            </div>
          </div>
          <div className="text-right shrink-0 text-base font-semibold tabular-nums">{b.totalCents ? formatMoney(b.totalCents, b.currency) : t("bookings.free")}</div>
        </div>
      </Card>
    </Link>
  );
}
