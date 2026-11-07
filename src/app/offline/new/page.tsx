import type { Metadata } from "next";
import { OfflineNewMatch } from "@/components/pwa/offline-new";
import { OfflineDocumentTitle } from "@/components/pwa/offline-home";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Durchgang starten (offline)" };

/** Neuen Durchgang ohne Verbindung starten (Programme und Mitglieder aus dem Offline-Snapshot). */
export default function OfflineNewMatchPage() {
  return (
    <>
      <OfflineDocumentTitle page="new" />
      <OfflineNewMatch />
    </>
  );
}
