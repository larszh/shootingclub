"use client";

import { useState, useTransition } from "react";
import { Check, PackageCheck, RotateCcw, ShieldCheck, Undo2, XCircle } from "lucide-react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { confirmDialog } from "@/components/ui/dialog";
import { isNavigationError, toast } from "@/lib/ui-feedback";
import { approveOrderAction, cancelMyOrderAction, cancelOrderAction, issueOrderAction, savePaymentNoteAction, setPaymentStatusAction } from "@/modules/ammo/actions";

/** Bestätigung «Berechtigung geprüft» + Ausgabe-Knopf. Für Detailseite und Theke. */
export function IssueControls({ orderId, requireIdCheck, onDone, size = "lg" }: { orderId: string; requireIdCheck: boolean; onDone?: () => void; size?: "md" | "lg" }) {
  const [checked, setChecked] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2.5">
      {requireIdCheck ? (
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-control border border-line bg-surface-2 px-3 py-2.5">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="h-6 w-6 shrink-0 accent-[var(--ink)]" />
          <span className="flex items-center gap-2 text-[15px] font-medium"><ShieldCheck className="h-5 w-5 text-ink-2" aria-hidden /> Berechtigung geprüft</span>
        </label>
      ) : null}
      {error ? <Alert>{error}</Alert> : null}
      <Button
        type="button"
        size={size}
        className="w-full"
        disabled={pending || (requireIdCheck && !checked)}
        aria-busy={pending || undefined}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              const r = await issueOrderAction(orderId, requireIdCheck ? checked : true);
              if (!r.ok) {
                setError(r.error);
                return;
              }
              toast.success(r.message ?? "Ausgegeben.");
              setChecked(false);
              onDone?.();
            } catch (e) {
              if (isNavigationError(e)) throw e;
              setError("Das hat nicht geklappt. Bitte nochmals versuchen.");
            }
          })
        }
      >
        <PackageCheck className="h-5 w-5" /> {pending ? "Wird ausgegeben…" : "Als ausgegeben markieren"}
      </Button>
    </div>
  );
}

export function ApproveButton({ orderId }: { orderId: string }) {
  return (
    <ActionButton variant="secondary" className="w-full" action={() => approveOrderAction(orderId)}>
      <Check className="h-4 w-4" /> Freigeben
    </ActionButton>
  );
}

export function CancelOrderButton({ orderId, issued, hasStock }: { orderId: string; issued: boolean; hasStock: boolean }) {
  if (!issued) {
    return (
      <ActionButton variant="ghost" className="w-full" action={() => cancelOrderAction(orderId)} confirm={{ title: "Bestellung stornieren?", message: "Es wurde noch nichts ausgegeben oder abgebucht.", tone: "danger", confirmLabel: "Stornieren", cancelLabel: "Behalten" }}>
        <XCircle className="h-4 w-4" /> Bestellung stornieren
      </ActionButton>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {hasStock ? (
        <ActionButton variant="secondary" action={() => cancelOrderAction(orderId, { restock: true })} confirm={{ title: "Rücknahme buchen?", message: "Die Munition kommt zurück an Lager, die Rechnung wird storniert.", tone: "danger", confirmLabel: "Rücknahme buchen" }}>
          <Undo2 className="h-4 w-4" /> Rücknahme (zurück an Lager)
        </ActionButton>
      ) : null}
      <ActionButton variant="ghost" action={() => cancelOrderAction(orderId)} confirm={{ title: "Ausgegebene Bestellung stornieren?", message: "Die Rechnung wird storniert. Der Bestand bleibt unverändert.", tone: "danger", confirmLabel: "Stornieren", cancelLabel: "Behalten" }}>
        <XCircle className="h-4 w-4" /> Stornieren ohne Rücknahme
      </ActionButton>
    </div>
  );
}

/** Zahlungsstatus einer Rechnung setzen und Notiz pflegen. */
export function PaymentControls({ orderId, paymentStatus, paymentNote }: { orderId: string; paymentStatus: string; paymentNote: string | null }) {
  const [note, setNote] = useState(paymentNote ?? "");
  const [pending, start] = useTransition();

  function set(status: "UNPAID" | "PAID" | "CANCELLED") {
    start(async () => {
      if (status === "CANCELLED" && !(await confirmDialog({ title: "Rechnung stornieren?", message: "Die Munition bleibt als ausgegeben verbucht.", tone: "danger", confirmLabel: "Rechnung stornieren", cancelLabel: "Behalten" }))) return;
      const r = await setPaymentStatusAction(orderId, status, note);
      if (!r.ok) toast.error(r.error);
      else toast.success(r.message ?? "Gespeichert.");
    });
  }

  return (
    <Card className="space-y-3 p-4">
      <Field label="Zahlungsnotiz (optional)" hint="z.B. «bar bezahlt» oder Datum der Gutschrift">
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={191} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {paymentStatus !== "PAID" ? <Button type="button" disabled={pending} onClick={() => set("PAID")}><Check className="h-4 w-4" /> Bezahlt</Button> : null}
        {paymentStatus !== "UNPAID" ? <Button type="button" variant="secondary" disabled={pending} onClick={() => set("UNPAID")}><RotateCcw className="h-4 w-4" /> Unbezahlt</Button> : null}
        {paymentStatus !== "CANCELLED" ? <Button type="button" variant="ghost" disabled={pending} onClick={() => set("CANCELLED")}><XCircle className="h-4 w-4" /> Rechnung stornieren</Button> : null}
        <Button
          type="button"
          variant="ghost"
          disabled={pending || note === (paymentNote ?? "")}
          onClick={() => start(async () => { const r = await savePaymentNoteAction(orderId, note); if (!r.ok) toast.error(r.error); else toast.success(r.message ?? "Gespeichert."); })}
        >
          Notiz speichern
        </Button>
      </div>
    </Card>
  );
}

/** Storno durch das Mitglied (nur vor der Ausgabe). */
export function MemberCancelButton({ orderId }: { orderId: string }) {
  return (
    <ActionButton size="sm" variant="ghost" className="h-11" action={() => cancelMyOrderAction(orderId)} confirm={{ title: "Bestellung stornieren?", tone: "danger", confirmLabel: "Stornieren", cancelLabel: "Behalten" }}>
      <XCircle className="h-4 w-4" /> Stornieren
    </ActionButton>
  );
}
