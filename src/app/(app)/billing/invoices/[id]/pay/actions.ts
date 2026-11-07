"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant";
import { fail, type ActionResult } from "@/lib/action-result";
import { startFeeInvoicePayment } from "@/modules/billing/payments";
import { getRequestLocale, getT } from "@/lib/i18n";
import { localizeMessage } from "@/modules/billing/ui/i18n";

const idSchema = z.string().min(1).max(40);

/** Online-Zahlung einer eigenen offenen Rechnung starten und zum Anbieter weiterleiten. */
export async function payFeeInvoiceOnlineAction(invoiceId: string): Promise<ActionResult> {
  const ctx = await requireTenant();
  const locale = await getRequestLocale();
  const id = idSchema.safeParse(invoiceId);
  if (!id.success) return fail(getT(locale)("money.pay.invalidInvoice"));
  const r = await startFeeInvoicePayment({ tenantId: ctx.tenant.id, userId: ctx.user.id, email: ctx.user.email }, id.data);
  if (!r.ok) return fail(localizeMessage(r.error, locale));
  redirect(r.redirectUrl);
}
