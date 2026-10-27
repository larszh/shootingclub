import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { OfflineMatch } from "@/components/pwa/offline-match";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Durchgang (offline)" };

/** Durchgang aus dem Gerätespeicher (IndexedDB), z.B. /offline/match?key=c:<clientId>. */
export default function OfflineMatchPage() {
  return (
    <Suspense fallback={<div className="space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-40" /></div>}>
      <OfflineMatch />
    </Suspense>
  );
}
