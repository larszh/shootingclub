"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Ban, CheckCircle2, Trash2, Wrench } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { deleteWeaponAction, setWeaponStatusAction } from "@/modules/weapons/actions";

/** Statuswechsel für Waffenverantwortliche: sperren (mit Grund), in Wartung, ausmustern, freigeben, löschen. */
export function StatusActions({ weapon }: { weapon: { id: string; name: string; status: string; hasLoans: boolean } }) {
  const router = useRouter();
  const [blockOpen, setBlockOpen] = useState(false);
  const s = weapon.status;
  if (s === "LOANED") return <p className="text-sm text-ink-3">Statuswechsel erst nach der Rückgabe möglich.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {s !== "AVAILABLE" ? (
        <ActionButton variant="secondary" action={() => setWeaponStatusAction(weapon.id, "AVAILABLE")}
          confirm={s === "RETIRED" ? { title: "Wieder in Betrieb nehmen?", message: `${weapon.name} wird wieder als verfügbar geführt.`, confirmLabel: "Freigeben" } : undefined}>
          <CheckCircle2 className="h-4 w-4" /> Freigeben
        </ActionButton>
      ) : null}
      {s === "AVAILABLE" ? (
        <ActionButton variant="secondary" action={() => setWeaponStatusAction(weapon.id, "SERVICE")}><Wrench className="h-4 w-4" /> In Wartung</ActionButton>
      ) : null}
      {s !== "BLOCKED" && s !== "RETIRED" ? (
        <Button variant="secondary" onClick={() => setBlockOpen(true)}><Ban className="h-4 w-4" /> Sperren</Button>
      ) : null}
      {s !== "RETIRED" ? (
        <ActionButton variant="secondary" action={() => setWeaponStatusAction(weapon.id, "RETIRED")}
          confirm={{ title: `${weapon.name} ausmustern?`, message: "Die Waffe kann danach nicht mehr ausgeliehen werden. Ausleih- und Wartungsnachweise bleiben erhalten.", confirmLabel: "Ausmustern", tone: "danger" }}>
          <Archive className="h-4 w-4" /> Ausmustern
        </ActionButton>
      ) : null}
      {!weapon.hasLoans ? (
        <ActionButton variant="ghost" className="text-danger" action={() => deleteWeaponAction(weapon.id)} onSuccess={() => router.push("/weapons")}
          confirm={{ title: `${weapon.name} löschen?`, message: "Nur für versehentlich erfasste Waffen. Endgültig.", confirmLabel: "Löschen", tone: "danger" }}>
          <Trash2 className="h-4 w-4" /> Löschen
        </ActionButton>
      ) : null}
      {blockOpen ? <BlockDialog id={weapon.id} name={weapon.name} onClose={() => setBlockOpen(false)} /> : null}
    </div>
  );
}

function BlockDialog({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function submit() {
    setError(null);
    if (!reason.trim()) return setError("Bitte einen Grund angeben.");
    start(async () => {
      try {
        const r = await setWeaponStatusAction(id, "BLOCKED", reason);
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? "Gesperrt.");
        onClose();
        router.refresh();
      } catch {
        setError("Keine Verbindung. Bitte nochmals versuchen.");
      }
    });
  }
  return (
    <Dialog open onClose={onClose} title="Waffe sperren" description={name}
      footer={<Button variant="danger" onClick={submit} disabled={pending}>{pending ? <Spinner /> : <Ban className="h-4 w-4" />} Sperren</Button>}>
      <div className="space-y-3 pb-2">
        <Field label="Grund" hint="z.B. «Abzug defekt, zur Reparatur»"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={191} data-autofocus /></Field>
        {error ? <Alert>{error}</Alert> : null}
      </div>
    </Dialog>
  );
}
