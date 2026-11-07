import { OfflineDocumentTitle, OfflineHome } from "@/components/pwa/offline-home";

export const dynamic = "force-static";

/** Fallback-Seite des Service Workers, wenn eine Seite offline nicht verfügbar ist. */
export default function OfflinePage() {
  return (
    <>
      <OfflineDocumentTitle page="home" />
      <OfflineHome />
    </>
  );
}
