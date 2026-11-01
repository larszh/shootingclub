"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { ACCOUNT_FIELDS, accountPlanSchema, DEFAULT_ACCOUNTS, toAccountPlan, type AccountPlan } from "./types";

/** Kontenplan speichern (accounting.export). Mit `reset` werden die Standardkonten wiederhergestellt. */
export async function saveAccountingSettingsAction(_prev: ActionResult<AccountPlan> | null, formData: FormData): Promise<ActionResult<AccountPlan>> {
  const ctx = await requirePermission("accounting.export");
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
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return fail("Bitte die markierten Konten prüfen.", fieldErrors);
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
  return ok(plan, reset ? "Standardkonten (KMU-Kontenrahmen) wiederhergestellt." : "Kontenplan gespeichert.");
}
