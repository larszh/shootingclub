import "server-only";

export type QrCreditor = { name: string; street: string; zip: string; city: string; iban: string };
export type QrDebtor = { name: string; street?: string | null; zip?: string | null; city?: string | null };

type QrInput = { amountCents: number; currency: string; creditor: QrCreditor; debtor?: QrDebtor | null; message: string };

function splitStreet(street: string) {
  const m = street.match(/^(.*?)[\s,]+(\d+[a-zA-Z]?)$/);
  return { address: m ? m[1]! : street, buildingNumber: m ? m[2] : undefined };
}

/** Schweizer QR-Rechnung (Zahlteil + Empfangsschein) als SVG. Gibt null zurück, wenn Angaben fehlen. */
export async function renderQrBillSvg(input: QrInput): Promise<string | null> {
  const { creditor } = input;
  if (!creditor.iban || !creditor.name || !creditor.street || !creditor.zip || !creditor.city) return null;
  if (input.currency !== "CHF" && input.currency !== "EUR") return null;
  try {
    const { SwissQRBill } = await import("swissqrbill/svg");
    const c = splitStreet(creditor.street);
    const debtorComplete = input.debtor?.name && input.debtor.street && input.debtor.zip && input.debtor.city;
    const d = debtorComplete ? splitStreet(input.debtor!.street!) : null;
    const svg = new SwissQRBill(
      {
        currency: input.currency,
        amount: input.amountCents / 100,
        creditor: { name: creditor.name, address: c.address, buildingNumber: c.buildingNumber, zip: creditor.zip, city: creditor.city, country: "CH", account: creditor.iban },
        ...(debtorComplete && d ? { debtor: { name: input.debtor!.name, address: d.address, buildingNumber: d.buildingNumber, zip: input.debtor!.zip!, city: input.debtor!.city!, country: "CH" } } : {}),
        message: input.message.slice(0, 140),
      },
      { language: "DE", scissors: true, outlines: true },
    );
    return svg.toString();
  } catch (e) {
    console.error("QR-Rechnung konnte nicht erzeugt werden:", e);
    return null;
  }
}
