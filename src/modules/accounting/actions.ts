"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getRequestLocale, getT } from "@/lib/i18n";
import { ACCOUNT_FIELDS, accountPlanSchema, DEFAULT_ACCOUNTS, toAccountPlan, type AccountPlan } from "./types";

/** Validierungsmeldungen aus accountPlanSchema (deutsch) → Wörterbuchschlüssel. */
const FIELD_MESSAGE_KEYS: Record<string, string> = {
  "Bitte eine Kontonummer angeben.": "adm1.acc.err.required",
  "Kontonummer zu lang (max. 20 Zeichen).": "adm1.acc.err.tooLong",
  "Kontonummern bestehen aus Ziffern, Buchstaben, Punkt oder Bindestrich.": "adm1.acc.err.format",
};

/** Kontenplan speichern (accounting.export). Mit `reset` werden die Standardkonten wiederhergestellt. */
export async function saveAccountingSettingsAction(_prev: ActionResult<AccountPlan> | null, formData: FormData): Promise<ActionResult<AccountPlan>> {
  const ctx = await requirePermission("accounting.export");
  const t = getT(await getRequestLocale());
  const reset = formData.get("intent") === "reset";
  let plan: AccountPlan;
  if (reset) {
    plan = { ...DEFAULT_ACCOUNTS };
  } else {
    const parsed = accountPlanSchema.safeParse(Object.fromEntries(ACCOUNT_FIELDS.map((f) => [f.key, String(formData.get(f.key) ?? "")])));
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !fieldErrors[key]) fieldErrors[key] = FIELD_MESSAGE_KEYS[issue.message] ? t(FIELD_MESSAGE_KEYS[issue.message]!) : issue.message;
      }
      return fail(t("adm1.acc.err.check"), fieldErrors);
    }
    plan = parsed.data;
  }

  const before = toAccountPlan(await db.accountingSettings.findUnique({ where: { tenantId: ctx.tenant.id } }));
  await db.accountingSettings.upsert({ where: { tenantId: ctx.tenant.id }, create: { tenantId: ctx.tenant.id, ...plan }, update: plan });
  const changes = ACCOUNT_FIELDS.filter((f) => before[f.key] !== plan[f.key]).map((f) => `${f.label}: ${before[f.key]} → ${plan[f.key]}`);
  await audit({
    tenantId: ctx.tenant.id,
    actorId: ctx.user.id,
    action: "accounting.settings.update",
    entity: "AccountingSettings",
    entityId: ctx.tenant.id,
    detail: reset ? "Standardkonten wiederhergestellt" : changes.length ? changes.join(", ") : "keine Änderung",
  });
  revalidatePath("/admin/accounting");
  return ok(plan, reset ? t("adm1.acc.restored") : t("adm1.acc.planSaved"));
}
