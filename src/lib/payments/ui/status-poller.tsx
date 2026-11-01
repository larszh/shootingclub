"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Lädt die (Server-)Seite in Abständen neu, solange eine Zahlung noch geprüft wird.
 * Nach `maxTries` Versuchen hört sie auf und zeigt einen Hinweis.
 */
export function PaymentStatusPoller({ intervalMs = 3000, maxTries = 20 }: { intervalMs?: number; maxTries?: number }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (tries >= maxTries) return;
    const t = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, intervalMs * (tries < 5 ? 1 : 2));
    return () => clearTimeout(t);
  }, [tries, maxTries, intervalMs, router]);
  return (
    <p className="mt-3 text-xs text-ink-3" aria-live="polite">
      {tries < maxTries ? "Status wird automatisch aktualisiert …" : "Noch keine Bestätigung. Lade die Seite später neu; die Zahlung wird auch nachträglich verbucht."}
    </p>
  );
}
