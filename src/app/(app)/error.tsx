"use client";

import { ErrorView } from "@/components/ui/error-view";

/** Fehler innerhalb der App (App-Shell bleibt sichtbar). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView error={error} reset={reset} compact />;
}
