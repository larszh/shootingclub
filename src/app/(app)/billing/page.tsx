import { requireModule } from "@/lib/tenant";
import { PlaceholderModule } from "@/components/placeholder-module";

export const metadata = { title: "Zahlungen" };

export default async function BillingPage() {
  await requireModule("billing");
  return (
    <PlaceholderModule title="Zahlungen" lead="Rechnungsstellung und Direktzahlung für Reservationen, Mitgliederbeiträge und Munition. Das Modul ist als Platzhalter angelegt."
      items={["Rechnungen mit Schweizer QR-Rechnung", "Direktzahlung via TWINT / Karte", "Mitgliederbeiträge und Munitionsabrechnung", "Export für die Vereinsbuchhaltung"]} />
  );
}
