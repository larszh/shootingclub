"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { ErrorView } from "@/components/ui/error-view";
import { useT } from "@/components/locale";

/** Fehler ausserhalb der App-Shell (z.B. Anmeldung, Druckansichten). */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <div className="min-h-dvh">
      <div className="flex justify-center pt-10">
        <Link href="/" aria-label={t("shell.common.homeAria")} className="inline-flex items-center gap-2 font-semibold tracking-tight">
          <Logo size={32} /> Standchef
        </Link>
      </div>
      <ErrorView error={error} reset={reset} />
    </div>
  );
}
