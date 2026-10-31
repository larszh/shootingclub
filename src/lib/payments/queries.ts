import "server-only";
import { db } from "@/lib/db";
import { feeInvoiceTitle } from "@/modules/billing/fee-title";

export type TenantPaymentKind = "BOOKING" | "FEE";

export type TenantPaymentRow = {
  id: string;
  kind: TenantPaymentKind;
  provider: string;
  providerRef: string;
  status: string;
  amountCents: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  memberName: string | null;
  href: string | null;
};

/** Alle Online-Zahlungen des Vereins (Reservationen und Beitragsrechnungen), neueste zuerst. */
export async function listTenantPayments(tenantId: string, opts?: { kind?: TenantPaymentKind; status?: string; take?: number }): Promise<TenantPaymentRow[]> {
  const kindWhere = opts?.kind === "BOOKING" ? { bookingId: { not: null } } : opts?.kind === "FEE" ? { feeInvoiceId: { not: null } } : {};
  const rows = await db.payment.findMany({
    where: {
      AND: [
        { OR: [{ tenantId }, { booking: { tenantId } }, { feeInvoice: { tenantId } }] },
        kindWhere,
        opts?.status ? { status: opts.status } : {},
      ],
    },
    include: {
      booking: { select: { id: true, startsAt: true, user: { select: { name: true } }, resource: { select: { name: true } } } },
      feeInvoice: { select: { id: true, number: true, memberName: true, categoryName: true, year: true, runId: true, membershipId: true, run: { select: { title: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(opts?.take ?? 200, 1), 1000),
  });
  return rows.map((p) => {
    const fee = p.feeInvoice;
    const b = p.booking;
    return {
      id: p.id,
      kind: fee ? "FEE" : "BOOKING",
      provider: p.provider,
      providerRef: p.providerRef,
      status: p.status,
      amountCents: p.amountCents,
      currency: p.currency,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      title: fee ? `${feeInvoiceTitle(fee, `Mitgliederbeitrag ${fee.year}`)} · ${fee.number}` : b ? `Reservation ${b.resource.name}` : "Zahlung",
      memberName: fee ? fee.memberName : b ? b.user?.name ?? "Gast" : null,
      href: fee ? `/billing/invoices/${fee.id}/print` : b ? `/bookings/${b.id}` : null,
    };
  });
}
