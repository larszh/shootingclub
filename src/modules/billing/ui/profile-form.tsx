"use client";

import { useActionState, useState } from "react";
import { Info } from "lucide-react";
import { saveBillingProfileAction } from "@/modules/billing/actions";
import type { BillingProfileView } from "@/modules/billing/profile";
import { compactCode, formatIban, isQrIban } from "@/lib/qr-reference";
import { Alert, Badge, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export function BillingProfileForm({ profile }: { profile: BillingProfileView }) {
  const [state, action] = useActionState(saveBillingProfileAction, null);
  const [iban, setIban] = useState(profile.iban ? formatIban(profile.iban) : "");
  const compact = compactCode(iban);
  const qr = isQrIban(compact);
  const plausible = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact);
  return (
    <div className="space-y-4">
      <Card className="animate-rise p-4">
        <form action={action} className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Zahlungsempfänger</h3>{profile.qrReady ? <Badge tone="ok">QR-Rechnung bereit</Badge> : <Badge tone="warn">unvollständig</Badge>}</div>
          <p className="text-xs text-ink-3">Diese Angaben stehen auf allen Rechnungen (Mitgliederbeiträge und Reservationen) und im QR-Zahlteil.</p>
          <Field label="Name"><Input name="payeeName" defaultValue={profile.payeeName ?? ""} placeholder="Schützengesellschaft Musterhausen" /></Field>
          <Field label="Strasse und Nr."><Input name="payeeStreet" defaultValue={profile.payeeStreet ?? ""} placeholder="Schützenstrasse 1" /></Field>
          <div className="grid grid-cols-[100px_1fr] gap-3 sm:grid-cols-[120px_1fr]">
            <Field label="PLZ"><Input name="payeeZip" defaultValue={profile.payeeZip ?? ""} inputMode="numeric" /></Field>
            <Field label="Ort"><Input name="payeeCity" defaultValue={profile.payeeCity ?? ""} /></Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px]">
            <Field label="IBAN oder QR-IBAN">
              <Input name="iban" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="CH93 0076 2011 6238 5295 7" className="font-mono" autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="Währung"><Select name="currency" defaultValue={profile.currency}><option value="CHF">CHF</option><option value="EUR">EUR</option></Select></Field>
          </div>
          {compact ? (
            <div className={cn("rounded-control px-3 py-2 text-sm", qr ? "bg-ok/10 text-ok" : plausible ? "bg-surface-2 text-ink-2" : "bg-warn/10 text-warn")}>
              {qr ? "QR-IBAN erkannt: Jede Rechnung erhält eine eigene Referenznummer. Zahlungen lassen sich so automatisch zuordnen."
                : plausible ? "Normale IBAN: Rechnungen enthalten die Rechnungsnummer als Mitteilung (ohne Referenznummer)."
                  : "Bitte die IBAN vollständig eingeben."}
            </div>
          ) : null}
          {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
          <SubmitButton>Speichern</SubmitButton>
        </form>
      </Card>

      <Card className="animate-rise p-4 text-sm space-y-2">
        <div className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4 text-ink-2" /> IBAN oder QR-IBAN?</div>
        <div className="flex items-center gap-2 text-xs"><span className="text-ink-3">Aktiver Modus:</span>{profile.iban ? (profile.qrIban ? <Badge tone="ok">QR-IBAN mit Referenz</Badge> : <Badge>IBAN mit Mitteilung</Badge>) : <Badge tone="warn">noch keine IBAN</Badge>}</div>
        <p className="text-ink-2"><span className="font-medium">Normale IBAN</span> (z.B. CH93 0076 …): funktioniert sofort. Mitglieder zahlen mit der Rechnungsnummer als Mitteilung; der Abgleich erfolgt über Nummer und Betrag.</p>
        <p className="text-ink-2"><span className="font-medium">QR-IBAN</span> (5. bis 9. Stelle zwischen 30000 und 31999, z.B. CH44 3199 9…): gibt es bei eurer Bank kostenlos zum Vereinskonto. Jede Rechnung bekommt eine 27-stellige Referenz. Im Bankimport werden Zahlungen damit eindeutig erkannt, auch wenn jemand die Mitteilung vergisst.</p>
        <p className="text-xs text-ink-3">Wechselt ihr auf eine QR-IBAN, erhalten auch bereits erstellte offene Rechnungen beim nächsten Öffnen automatisch eine Referenz.</p>
      </Card>
    </div>
  );
}
