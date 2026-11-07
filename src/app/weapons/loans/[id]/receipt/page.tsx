import { notFound } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDate, formatDateTime } from "@/lib/i18n/core";
import { INTL_LOCALE } from "@/lib/i18n/locales";
import { PrintSheet, printedAt, SignatureLines } from "@/modules/ammo/ui/print-sheet";
import { requireWeapons } from "@/modules/weapons/guard";
import { getLoan } from "@/modules/weapons/queries";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm2.weapons.rc.title") };
}

/** Ausleihquittung einer Vereinswaffe (A4) mit Bedingungen und Unterschriftsfeldern. */
export default async function LoanReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWeapons();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const dt = (d: Date) => formatDateTime(d, locale);
  const { id } = await params;
  const loan = await getLoan(ctx.tenant.id, id.slice(0, 40));
  if (!loan) notFound();
  const canManage = ctx.can("weapons.manage");
  const w = loan.weapon;
  const address = loan.user ? [loan.user.street, [loan.user.zip, loan.user.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";
  const line = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[38mm_1fr] gap-2 border-b border-neutral-200 py-1.5">
      <div className="text-neutral-500">{label}</div>
      <div>{value || <span className="inline-block w-full border-b border-dotted border-neutral-400">&nbsp;</span>}</div>
    </div>
  );

  return (
    <PrintShell title={t("adm2.weapons.rc.title")} subtitle={`${w.name} · ${loan.borrower}`} action={<PrintButton />}>
      <PrintSheet
        tenantName={ctx.tenant.name}
        title={t("adm2.weapons.rc.sheetTitle")}
        subtitle={t("adm2.weapons.rc.issuedAt", { date: dt(loan.loanedAt) })}
        footer={<>{t("adm2.common.createdWith", { date: printedAt(locale) })} {t("adm2.weapons.responsibility")}</>}
      >
        <h2 className="mb-1 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">{t("adm2.weapons.rc.weapon")}</h2>
        {line(t("adm2.weapons.form.name"), w.name)}
        {line(t("adm2.weapons.form.discipline"), w.discipline)}
        {line(t("adm2.weapons.rc.makeModel"), [w.manufacturer, w.model].filter(Boolean).join(" "))}
        {line(t("adm2.weapons.form.caliber"), w.caliber)}
        {line(t("adm2.weapons.form.serial"), canManage ? w.serialNumber : null)}
        {line(t("adm2.weapons.rc.shotsAtIssue"), `${new Intl.NumberFormat(INTL_LOCALE[locale]).format(w.shotCount)}`)}

        <h2 className="mb-1 mt-5 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">{t("adm2.weapons.rc.borrower")}</h2>
        {line(t("adm2.common.name"), loan.borrower)}
        {line(t("adm2.weapons.rc.address"), address)}
        {line(t("adm2.common.phone"), loan.user?.phone ?? null)}
        {line(t("adm2.weapons.rc.minor"), loan.isMinor ? t("adm2.common.yes") : t("adm2.common.no"))}

        <h2 className="mb-1 mt-5 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">{t("adm2.weapons.rc.loan")}</h2>
        {line(t("adm2.weapons.rc.issuedOn"), dt(loan.loanedAt))}
        {line(t("adm2.weapons.rc.issuedBy"), loan.issuedByName)}
        {line(t("adm2.weapons.rc.dueBy"), loan.dueAt ? formatDate(loan.dueAt, locale) : loan.onSiteOnly ? t("adm2.weapons.rc.sameDay") : null)}
        {loan.note ? line(t("adm2.weapons.rc.remark"), loan.note) : null}

        <h2 className="mb-1 mt-5 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">{t("adm2.weapons.rc.conditions")}</h2>
        <ul className="list-disc space-y-1 pl-5">
          {loan.onSiteOnly ? <li>{t("adm2.weapons.rc.c.onSite")}</li> : <li>{t("adm2.weapons.rc.c.transport")}</li>}
          <li>{t("adm2.weapons.rc.c.condition")}</li>
          <li>{t("adm2.weapons.rc.c.return")}</li>
          <li>{t("adm2.weapons.rc.c.rules")}</li>
          {loan.isMinor ? <li>{t("adm2.weapons.minorHint")}{loan.reportDueAt ? t("adm2.weapons.rc.c.deadline", { date: formatDate(loan.reportDueAt, locale) }) : ""}</li> : null}
        </ul>

        <SignatureLines labels={[loan.isMinor ? t("adm2.weapons.rc.sigBorrowerMinor") : t("adm2.weapons.rc.sigBorrower"), t("adm2.weapons.rc.sigIssue")]} />

        <h2 className="mb-1 mt-8 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">{t("adm2.weapons.rc.return")}</h2>
        {line(t("adm2.weapons.rc.returnedOn"), loan.returnedAt ? dt(loan.returnedAt) : null)}
        {line(t("adm2.weapons.ret.shots"), loan.shots !== null ? String(loan.shots) : null)}
        {line(t("adm2.weapons.rc.condition"), null)}
        <SignatureLines labels={[t("adm2.weapons.rc.sigBorrower"), t("adm2.weapons.rc.sigReturn")]} />
      </PrintSheet>
    </PrintShell>
  );
}
