import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { getAppContext } from "@/lib/tenant";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { soleOwnerTenants } from "@/modules/core/privacy";
import { DeleteAccountCard, ExportCard } from "./forms";

export const metadata: Metadata = { title: "Datenschutz" };

export default async function PrivacyPage() {
  const ctx = await getAppContext();
  const blockers = await soleOwnerTenants(ctx.user.id);

  return (
    <div>
      <PageHeader title="Datenschutz" subtitle="Deine Daten herunterladen oder dein Konto löschen" back={{ href: "/me", label: "Mehr" }} />

      <Card className="animate-rise flex items-start gap-3 p-4">
        <span className="mt-0.5 text-ok" aria-hidden><ShieldCheck className="h-6 w-6" /></span>
        <div className="min-w-0 text-sm text-ink-2">
          <p className="font-semibold text-ink">Deine Daten gehören dir</p>
          <p>Nach dem Schweizer Datenschutzgesetz (revDSG) kannst du jederzeit Auskunft über deine gespeicherten Daten verlangen oder dein Konto löschen.</p>
        </div>
      </Card>

      <SectionTitle>Meine Daten herunterladen</SectionTitle>
      <ExportCard />

      <SectionTitle>Konto löschen</SectionTitle>
      <DeleteAccountCard blockers={blockers.map((b) => b.name)} />
    </div>
  );
}
