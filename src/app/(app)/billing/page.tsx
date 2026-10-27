import { requireModule } from "@/lib/tenant";
import { PlaceholderModule } from "@/components/placeholder-module";

export const metadata = { title: "Mitgliederbeiträge" };

export default async function BillingPage() {
  await requireModule("billing");
  return (
    <PlaceholderModule title="Mitgliederbeiträge" lead="Jahresbeiträge und Sammelrechnungen für Mitglieder. Zahlungen für Reservationen laufen bereits über das Modul Reservationen. Dieses Modul ist als Platzhalter angelegt."
      items={["Beitragskategorien (Aktiv, Passiv, Jungschützen) pro Tenant", "Jahresrechnung mit QR-Rechnung an alle Mitglieder", "Zahlungsabgleich und Mahnwesen", "Export für die Vereinsbuchhaltung"]} />
  );
}
