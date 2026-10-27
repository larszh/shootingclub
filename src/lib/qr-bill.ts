import "server-only";
import { compactCode, isQrIban, isValidQrReference } from "@/lib/qr-reference";

export type QrCreditor = { name: string; street: string; zip: string; city: string; iban: string };
export type QrDebtor = { name: string; street?: string | null; zip?: string | null; city?: string | null };

type QrInput = {
  amountCents: number;
  currency: string;
  creditor: QrCreditor;
  debtor?: QrDebtor | null;
  /** Zusätzliche Mitteilung (Zahlungszweck). Bei QR-IBAN optional, sonst der einzige Verweis. */
  message?: string | null;
  /** QR-Referenz (27 Ziffern). Wird nur zusammen mit einer QR-IBAN verwendet. */
  reference?: string | null;
};

function splitStreet(street: string) {
  const m = street.match(/^(.*?)[\s,]+(\d+[a-zA-Z]?)$/);
  return { address: m ? m[1]! : street, buildingNumber: m ? m[2] : undefined };
}

/**
 * Schweizer QR-Rechnung (Zahlteil + Empfangsschein) als SVG. Gibt null zurück, wenn Angaben fehlen.
 *
 * - QR-IBAN: verlangt eine gültige QR-Referenz (sonst null), Mitteilung optional.
 * - Normale IBAN: ohne Referenz, nur mit Mitteilung (bisheriges Verhalten).
 */
export async function renderQrBillSvg(input: QrInput): Promise<string | null> {
  const { creditor } = input;
  if (!creditor.iban || !creditor.name || !creditor.street || !creditor.zip || !creditor.city) return null;
  if (input.currency !== "CHF" && input.currency !== "EUR") return null;
  const qrIban = isQrIban(creditor.iban);
  const reference = input.reference ? compactCode(input.reference) : null;
  if (qrIban && (!reference || !isValidQrReference(reference))) {
    console.error("QR-Rechnung: QR-IBAN ohne gültige QR-Referenz.");
    return null;
  }
  try {
    const { SwissQRBill } = await import("swissqrbill/svg");
    const c = splitStreet(creditor.street);
    const debtorComplete = input.debtor?.name && input.debtor.street && input.debtor.zip && input.debtor.city;
    const d = debtorComplete ? splitStreet(input.debtor!.street!) : null;
    const message = input.message?.trim() ? input.message.trim().slice(0, 140) : undefined;
    const svg = new SwissQRBill(
      {
        currency: input.currency,
        amount: input.amountCents / 100,
        creditor: { name: creditor.name, address: c.address, buildingNumber: c.buildingNumber, zip: creditor.zip, city: creditor.city, country: "CH", account: compactCode(creditor.iban) },
        ...(debtorComplete && d ? { debtor: { name: input.debtor!.name, address: d.address, buildingNumber: d.buildingNumber, zip: input.debtor!.zip!, city: input.debtor!.city!, country: "CH" } } : {}),
        ...(qrIban && reference ? { reference } : {}),
        ...(message ? { message } : {}),
      },
      { language: "DE", scissors: true, outlines: true },
    );
    return svg.toString();
  } catch (e) {
    console.error("QR-Rechnung konnte nicht erzeugt werden:", e);
    return null;
  }
}
