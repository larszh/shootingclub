import type { Metadata } from "next";
import { OfflineNewMatch } from "@/components/pwa/offline-new";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Durchgang starten (offline)" };

/** Neuen Durchgang ohne Verbindung starten (Programme und Mitglieder aus dem Offline-Snapshot). */
export default function OfflineNewMatchPage() {
  return <OfflineNewMatch />;
}
