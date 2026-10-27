import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { getTarget } from "@/modules/targets/queries";
import { TargetForm } from "@/modules/targets/ui/target-form";

export const metadata: Metadata = { title: "Scheibe bearbeiten" };

export default async function EditTargetPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireModule("targets");
  const { id } = await params;
  const t = await getTarget(ctx, id);
  if (!t) notFound();
  const scope = t.scope === "mine" ? "mine" : t.scope === "tenant" && !t.ownerUserId && ctx.can("tenant.targets.manage") ? "tenant" : null;
  if (!scope) notFound();
  return (
    <div>
      <PageHeader title="Scheibe bearbeiten" back={{ href: `/targets/${id}`, label: t.name }} />
      <TargetForm scope={scope} initial={{ id: t.id, name: t.name, description: t.description, subject: t.subject, paperSizes: t.paperSizes, params: t.params, sharedWithTenant: t.sharedWithTenant, filePath: t.filePath }} />
    </div>
  );
}
