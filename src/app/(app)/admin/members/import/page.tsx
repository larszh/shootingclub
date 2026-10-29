import type { Metadata } from "next";
import { requirePermission } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { IMPORT_FIELDS, FIELD_LABELS, IMPORT_PRESETS, type ImportPresetId } from "@/modules/members/import";
import { MembersNav } from "../nav";
import { ImportWizard } from "./wizard";

export const metadata: Metadata = { title: "Mitglieder importieren" };

export default async function ImportPage() {
  const ctx = await requirePermission("members.manage");
  const [households, categories] = await Promise.all([
    db.household.count({ where: { tenantId: ctx.tenant.id } }),
    db.feeCategory.findMany({ where: { tenantId: ctx.tenant.id, isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { name: true } }),
  ]);
  return (
    <div>
      <PageHeader title="Mitglieder importieren" subtitle="Aus ClubDesk, WebLing oder Excel (CSV oder .xlsx)" back={{ href: "/admin/members", label: "Mitglieder" }} />
      <MembersNav active="import" canManage counts={{ households }} />
      <ImportWizard
        fields={IMPORT_FIELDS.map((f) => ({ value: f, label: FIELD_LABELS[f] }))}
        presets={(Object.keys(IMPORT_PRESETS) as ImportPresetId[]).map((id) => ({ id, label: IMPORT_PRESETS[id].label, hint: IMPORT_PRESETS[id].hint }))}
        categoryNames={categories.map((c) => c.name)}
      />
    </div>
  );
}
