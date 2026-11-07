import type { Metadata } from "next";
import { requirePermission } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { IMPORT_FIELDS, IMPORT_PRESETS, type ImportPresetId } from "@/modules/members/import";
import { MembersNav } from "../nav";
import { ImportWizard } from "./wizard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.import.title") };
}

export default async function ImportPage() {
  const ctx = await requirePermission("members.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const [households, categories] = await Promise.all([
    db.household.count({ where: { tenantId: ctx.tenant.id } }),
    db.feeCategory.findMany({ where: { tenantId: ctx.tenant.id, isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { name: true } }),
  ]);
  return (
    <div>
      <PageHeader title={t("adm1.import.title")} subtitle={t("adm1.import.subtitle")} back={{ href: "/admin/members", label: t("adm1.members.title") }} />
      <MembersNav active="import" canApprove={ctx.can("members.approve")} tenantId={ctx.tenant.id} canManage counts={{ households }} />
      <ImportWizard
        locale={locale}
        fields={IMPORT_FIELDS.map((f) => ({ value: f, label: t(`adm1.import.field.${f}`) }))}
        presets={(Object.keys(IMPORT_PRESETS) as ImportPresetId[]).map((id) => ({ id, label: t(`adm1.import.preset.${id}.label`), hint: t(`adm1.import.preset.${id}.hint`) }))}
        categoryNames={categories.map((c) => c.name)}
      />
    </div>
  );
}
