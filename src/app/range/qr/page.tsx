import QRCode from "qrcode";
import { appUrl } from "@/lib/mail";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { requireRangeDuty } from "@/modules/range/guard";
import { EMERGENCY_NUMBERS } from "@/modules/range/types";

export const metadata = { title: "QR-Code Check-in" };

/** A4-Aushang mit QR-Code für den Selbst-Check-in der Mitglieder. */
export default async function RangeQrPrintPage() {
  const ctx = await requireRangeDuty();
  const url = appUrl(`/range/checkin?t=${encodeURIComponent(ctx.tenant.id)}`);
  const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 900 });
  return (
    <PrintShell title="QR-Code Check-in" subtitle="A4 zum Aufhängen im Schützenhaus" action={<PrintButton />}>
      <div className="flex h-[297mm] w-[210mm] flex-col items-center bg-white px-[18mm] py-[20mm] text-center text-neutral-900 shadow print:shadow-none">
        <div className="text-[13pt] uppercase tracking-[0.2em] text-neutral-500">{ctx.tenant.name}</div>
        <h1 className="mt-3 text-[34pt] font-bold leading-tight">Check-in am Stand</h1>
        <p className="mt-2 text-[15pt] text-neutral-600">QR-Code mit dem Handy scannen und einchecken.<br />Beim Gehen wieder auschecken.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR-Code zum Check-in" className="mt-10 h-[110mm] w-[110mm]" />
        <p className="mt-4 break-all font-mono text-[10pt] text-neutral-500">{url}</p>
        <p className="mt-8 max-w-[150mm] text-[12pt] text-neutral-700">Beim ersten Check-in bestätigst du die aktuelle Standordnung. Gäste melden sich beim Standdienst.</p>
        <div className="mt-auto w-full border-t border-neutral-300 pt-5">
          <div className="text-[11pt] font-semibold uppercase tracking-wider text-red-700">Notfall</div>
          <div className="mt-2 flex justify-center gap-8 text-[14pt]">
            {EMERGENCY_NUMBERS.map((n) => <span key={n.number}><strong>{n.number}</strong> {n.label}</span>)}
          </div>
        </div>
      </div>
    </PrintShell>
  );
}
