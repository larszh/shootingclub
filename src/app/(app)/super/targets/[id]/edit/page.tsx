import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { parsePaperSizes, targetParamsSchema } from "@/modules/targets/types";
import { TargetForm } from "@/modules/targets/ui/target-form";

export const metadata = { title: "Globale Scheibe bearbeiten" };

export default async function SuperEditTargetPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const t = await db.targetTemplate.findUnique({ where: { id } });
  if (!t || t.tenantId !== null || t.ownerUserId !== null) notFound();
  const params_ = targetParamsSchema.safeParse(JSON.parse(t.paramsJson || "{}"));
  return (
    <div>
      <PageHeader title="Globale Scheibe bearbeiten" back={{ href: "/super/targets", label: "Globale Scheiben" }} />
      <TargetForm scope="global" initial={{ id: t.id, name: t.name, description: t.description, subject: t.subject, paperSizes: parsePaperSizes(t.paperSizes), params: params_.success ? params_.data : {}, sharedWithTenant: false, filePath: t.filePath }} />
    </div>
  );
}
