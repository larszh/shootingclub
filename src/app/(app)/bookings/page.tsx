import { requireModule } from "@/lib/tenant";
import { PlaceholderModule } from "@/components/placeholder-module";

export const metadata = { title: "Reservationen" };

export default async function BookingsPage() {
  await requireModule("bookings");
  return (
    <PlaceholderModule title="Reservationen" lead="Hier werden Stände, Bahnen und Räume reservierbar. Das Modul ist als Platzhalter angelegt und kann pro Tenant aktiviert werden."
      items={["Ressourcen pro Tenant (Stand, Bahn, Raum) mit Öffnungszeiten", "Kalender mit Slots, Mehrfachbuchung und Wiederholungen", "Rollenbasierte Freigabe (Trainer, Mitglieder, Gäste)", "Anbindung an Zahlungen für kostenpflichtige Slots"]} />
  );
}
