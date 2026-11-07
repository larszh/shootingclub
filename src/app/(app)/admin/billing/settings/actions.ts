"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireBillingAdmin } from "@/modules/billing/guard";
import { providerKeys, providerLabel } from "@/lib/payments/catalog";
import { getRequestLocale, getT } from "@/lib/i18n";

const schema = z.enum(["NONE", ...providerKeys]);

/** Anbieter für die Online-Zahlung von Beitragsrechnungen wählen (nur eingerichtete, aktivierte). */
export async function saveOnlineFeeProviderAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireBillingAdmin();
  const t = getT(await getRequestLocale());
  const parsed = schema.safeParse(formData.get("onlineFeeProvider") || "NONE");
  if (!parsed.success) return fail(t("adm1.online.unknownProvider"));
  const provider = parsed.data;
  if (provider !== "NONE") {
    const cfg = await db.paymentProviderConfig.findUnique({ where: { tenantId_provider: { tenantId: ctx.tenant.id, provider } }, select: { enabled: true } });
    if (!cfg?.enabled) return fail(t("adm1.online.notEnabled", { provider: providerLabel(provider) }));
  }
  await db.billingProfile.upsert({
    where: { tenantId: ctx.tenant.id },
    create: { tenantId: ctx.tenant.id, payeeName: ctx.tenant.name, onlineFeeProvider: provider },
    update: { onlineFeeProvider: provider },
  });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "billing.online_provider.set", entity: "BillingProfile", detail: provider === "NONE" ? "Online-Zahlung aus" : providerLabel(provider) });
  revalidatePath("/admin/billing/settings");
  revalidatePath("/billing");
  revalidatePath("/payments");
  return ok(undefined, provider === "NONE" ? t("adm1.online.switchedOff") : t("adm1.online.switchedOn", { provider: providerLabel(provider) }));
}
