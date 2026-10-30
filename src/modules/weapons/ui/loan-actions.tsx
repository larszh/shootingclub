"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, FileCheck2, Undo2 } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { markReportedAction, returnLoanAction } from "@/modules/weapons/actions";

/** Knopf «Zurücknehmen» mit Dialog für die Schusszahl. */
export function ReturnButton({ loanId, label, size = "md", variant = "primary", className }: { loanId: string; label: string; size?: "sm" | "md"; variant?: "primary" | "secondary"; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} className={className} onClick={() => setOpen(true)}><CornerDownLeft className="h-4 w-4" /> Zurücknehmen</Button>
      {open ? <ReturnDialog loanId={loanId} label={label} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ReturnDialog({ loanId, label, onClose }: { loanId: string; label: string; onClose: () => void }) {
  const router = useRouter();
  const [shots, setShots] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const valid = shots === "" || /^\d{1,6}$/.test(shots);

  function submit() {
    setError(null);
    if (!valid) return setError("Bitte eine ganze Zahl eingeben.");
    start(async () => {
      try {
        const r = await returnLoanAction(loanId, shots === "" ? null : Number(shots));
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? "Zurückgenommen.");
        onClose();
        router.refresh();
      } catch {
        setError("Keine Verbindung. Bitte nochmals versuchen.");
      }
    });
  }

  return (
    <Dialog open onClose={onClose} title="Waffe zurücknehmen" description={label}
      footer={<Button onClick={submit} disabled={pending || !valid}>{pending ? <Spinner /> : <CornerDownLeft className="h-4 w-4" />} Zurücknehmen</Button>}>
      <div className="space-y-3 pb-2">
        <Field label="Abgegebene Schüsse" hint="Für Schusszähler und Wartungsintervall. Leer lassen, wenn unbekannt.">
          <Input value={shots} onChange={(e) => setShots(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="z.B. 60" className="text-lg" data-autofocus />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[20, 40, 60, 100].map((n) => (
            <Button key={n} type="button" variant="secondary" className="h-11 min-w-16" onClick={() => setShots(String(n))}>{n}</Button>
          ))}
        </div>
        <p className="text-xs text-ink-3">Bitte die Waffe beim Zurücknehmen auf Vollständigkeit und Zustand prüfen (entladen, Zubehör).</p>
        {error ? <Alert>{error}</Alert> : null}
      </div>
    </Dialog>
  );
}

/** «Als gemeldet markieren» bzw. (Verwaltung) Markierung entfernen. */
export function ReportButton({ loanId, reported, canUndo, size = "sm" }: { loanId: string; reported: boolean; canUndo: boolean; size?: "sm" | "md" }) {
  if (reported) {
    return canUndo ? (
      <ActionButton size={size} variant="ghost" className="h-11" action={() => markReportedAction(loanId, false)} confirm={{ title: "Markierung entfernen?", message: "Die Meldung gilt danach wieder als offen.", confirmLabel: "Entfernen" }}>
        <Undo2 className="h-4 w-4" /> Rückgängig
      </ActionButton>
    ) : null;
  }
  return (
    <ActionButton size={size} variant="secondary" className="h-11" action={() => markReportedAction(loanId, true)}
      confirm={{ title: "Als gemeldet markieren?", message: "Nur bestätigen, wenn die Meldung an die zuständige Stelle erfolgt ist.", confirmLabel: "Gemeldet" }}>
      <FileCheck2 className="h-4 w-4" /> Als gemeldet markieren
    </ActionButton>
  );
}
