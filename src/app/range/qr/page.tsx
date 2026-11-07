import QRCode from "qrcode";
import { appUrl } from "@/lib/mail";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { requireRangeDuty } from "@/modules/range/guard";
import { EMERGENCY_NUMBERS } from "@/modules/range/types";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata() {
  const t = getT(await getRequestLocale());
  return { title: t("adm2.range.qr.title") };
}

/** A4-Aushang mit QR-Code für den Selbst-Check-in der Mitglieder. */
export default async function RangeQrPrintPage() {
  const ctx = await requireRangeDuty();
  const t = getT(await getRequestLocale());
  const url = appUrl(`/range/checkin?t=${encodeURIComponent(ctx.tenant.id)}`);
  const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 900 });
  return (
    <PrintShell title={t("adm2.range.qr.title")} subtitle={t("adm2.range.qr.subtitle")} action={<PrintButton />}>
      <div className="flex h-[297mm] w-[210mm] flex-col items-center bg-white px-[18mm] py-[20mm] text-center text-neutral-900 shadow print:shadow-none">
        <div className="text-[13pt] uppercase tracking-[0.2em] text-neutral-500">{ctx.tenant.name}</div>
        <h1 className="mt-3 text-[34pt] font-bold leading-tight">{t("adm2.range.qr.heading")}</h1>
        <p className="mt-2 text-[15pt] text-neutral-600">{t("adm2.range.qr.scan")}<br />{t("adm2.range.qr.leave")}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={t("adm2.range.qr.alt")} className="mt-10 h-[110mm] w-[110mm]" />
        <p className="mt-4 break-all font-mono text-[10pt] text-neutral-500">{url}</p>
        <p className="mt-8 max-w-[150mm] text-[12pt] text-neutral-700">{t("adm2.range.qr.rules")}</p>
        <div className="mt-auto w-full border-t border-neutral-300 pt-5">
          <div className="text-[11pt] font-semibold uppercase tracking-wider text-red-700">{t("adm2.range.qr.emergency")}</div>
          <div className="mt-2 flex justify-center gap-8 text-[14pt]">
            {EMERGENCY_NUMBERS.map((n) => <span key={n.number}><strong>{n.number}</strong> {t(`adm2.range.emergency.${n.number}`)}</span>)}
          </div>
        </div>
      </div>
    </PrintShell>
  );
}
