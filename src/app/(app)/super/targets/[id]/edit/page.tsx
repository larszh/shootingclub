import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { parsePaperSizes, parseTargetParams } from "@/modules/targets/types";
import { TargetForm } from "@/modules/targets/ui/target-form";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm2.super.tg.editTitle") };
}

export default async function SuperEditTargetPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const tr = getT(await getRequestLocale());
  const { id } = await params;
  const t = await db.targetTemplate.findUnique({ where: { id } });
  if (!t || t.tenantId !== null || t.ownerUserId !== null) notFound();
  let rawParams: unknown = {};
  try { rawParams = JSON.parse(t.paramsJson || "{}"); } catch { rawParams = {}; }
  const parsedParams = parseTargetParams(rawParams);
  return (
    <div>
      <PageHeader title={tr("adm2.super.tg.editTitle")} back={{ href: "/super/targets", label: tr("adm2.super.targets") }} />
      <TargetForm scope="global" initial={{ id: t.id, name: t.name, description: t.description, subject: t.subject, paperSizes: parsePaperSizes(t.paperSizes), params: parsedParams, sharedWithTenant: false, filePath: t.filePath }} />
    </div>
  );
}
