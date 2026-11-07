"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Files } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { copyProgramToTenantAction, duplicateProgramAction } from "@/modules/scores/actions";
import { useT } from "@/components/locale";

/** «Als Vereinsprogramm kopieren» (globale Programme) bzw. «Duplizieren» (Vereinsprogramme). */
export function ProgramCopyButton({ programId, scope }: { programId: string; scope: "global" | "tenant" }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hideOriginal, setHideOriginal] = useState(false);

  const run = () =>
    start(async () => {
      setError(null);
      const res = scope === "global" ? await copyProgramToTenantAction(programId, { hideOriginal }) : await duplicateProgramAction(programId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data?.id) router.push(`/scores/programs/${res.data.id}/edit`);
    });

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={run}>
          {scope === "global" ? <><Copy className="h-4 w-4" /> {t("misc.program.copyToClub")}</> : <><Files className="h-4 w-4" /> {t("shooting.program.form.duplicate")}</>}
        </Button>
        {scope === "global" ? (
          <label className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-2 select-none">
            <input type="checkbox" checked={hideOriginal} onChange={(e) => setHideOriginal(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            {t("misc.program.hideOriginal")}
          </label>
        ) : null}
      </div>
      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}
