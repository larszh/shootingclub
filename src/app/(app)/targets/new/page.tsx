import type { Metadata } from "next";
import { requireModule } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { TargetForm } from "@/modules/targets/ui/target-form";

export const metadata: Metadata = { title: "Neue Scheibe" };

export default async function NewTargetPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const ctx = await requireModule("targets");
  const { scope } = await searchParams;
  const asTenant = scope === "tenant" && ctx.can("tenant.targets.manage");
  return (
    <div>
      <PageHeader title={asTenant ? "Vereinsscheibe anlegen" : "Eigene Scheibe"} subtitle={asTenant ? "Für alle Mitglieder sichtbar" : "Generieren oder eigenes Sujet hochladen"} back={{ href: "/targets", label: "Zielscheiben" }} />
      <TargetForm scope={asTenant ? "tenant" : "mine"} />
    </div>
  );
}
