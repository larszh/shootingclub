import { notFound, redirect } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { getRequestLocale, getT } from "@/lib/i18n";
import { dayKeyLabel } from "@/lib/i18n/extra/admin2/msg";
import { formatDate } from "@/lib/i18n/core";
import { PrintSheet, printedAt, SignatureLines } from "@/modules/ammo/ui/print-sheet";
import { requireCourses } from "@/modules/courses/guard";
import { dbDay } from "@/modules/courses/logic";
import { getQualificationCertificate } from "@/modules/courses/queries";
import { qualificationLabel } from "@/modules/qualifications/types";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm2.courses.pr.qcert") };
}

/** Qualifikationsnachweis (A4) mit Resultat und Unterschriftslinie der Ausbildnerin bzw. des Ausbildners. */
export default async function QualificationCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCourses();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const chDate = (d: string | null) => dayKeyLabel(d, locale);
  const { id } = await params;
  const q = await getQualificationCertificate(ctx.tenant.id, id.slice(0, 40));
  if (!q) notFound();
  const allowed = ctx.can("courses.manage") || ctx.can("qualifications.manage") || q.userId === ctx.user.id;
  if (!allowed) redirect("/courses?denied=1");
  const from = dbDay(q.validFrom);
  const until = dbDay(q.validUntil);
  const address = [q.user.street, [q.user.zip, q.user.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const line = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[45mm_1fr] gap-2 border-b border-neutral-200 py-1.5">
      <div className="text-neutral-500">{label}</div>
      <div>{value || <span className="inline-block w-full border-b border-dotted border-neutral-400">&nbsp;</span>}</div>
    </div>
  );

  return (
    <PrintShell title={t("adm2.courses.pr.qcert")} subtitle={`${q.user.name} · ${q.label ?? qualificationLabel(q.kind, t)}`} action={<PrintButton />}>
      <PrintSheet
        tenantName={ctx.tenant.name}
        title={t("adm2.courses.pr.qcert")}
        subtitle={q.label ?? qualificationLabel(q.kind, t)}
        footer={<>{t("adm2.common.createdWith", { date: printedAt(locale) })} {t("adm2.courses.qualResponsibility")}</>}
      >
        <h2 className="mb-1 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">{t("adm2.courses.pr.person")}</h2>
        {line(t("adm2.common.name"), q.user.name)}
        {line(t("adm2.courses.p.birth"), q.user.birthDate ? chDate(dbDay(q.user.birthDate)) : null)}
        {line(t("adm2.courses.pr.address"), address)}

        <h2 className="mb-1 mt-5 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">{t("adm2.courses.pr.qual")}</h2>
        {line(t("adm2.courses.pr.kind"), qualificationLabel(q.kind, t))}
        {line(t("adm2.courses.rule.name"), q.label)}
        {line(t("adm2.qual.dlg.validFrom"), from ? chDate(from) : null)}
        {line(t("adm2.qual.dlg.validUntil"), until ? chDate(until) : t("adm2.courses.q.unlimited"))}
        {q.number ? line(t("adm2.courses.pr.number"), q.number) : null}

        {q.source ? (
          <>
            <h2 className="mb-1 mt-5 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">{t("adm2.courses.q.title")}</h2>
            {line(t("adm2.common.date"), formatDate(q.source.match.finishedAt ?? q.source.match.date, locale))}
            {line(t("adm2.courses.pr.program"), q.source.match.program.name)}
            {line(t("adm2.courses.pr.result"), t("adm2.courses.pr.resultLine", { total: q.source.total ?? "–", zeros: q.source.zeros ?? "–" }))}
            {q.requirement ? line(t("adm2.courses.pr.requirement"), q.requirement) : null}
          </>
        ) : null}
        {q.note ? line(t("adm2.common.remark"), q.note) : null}

        <h2 className="mb-1 mt-5 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">{t("adm2.courses.pr.confirmation")}</h2>
        {line(t("adm2.courses.pr.instructor"), q.verifiedByName)}
        {line(t("adm2.courses.pr.grantedOn"), formatDate(q.createdAt, locale))}
        <SignatureLines labels={[t("adm2.common.placeDate"), `${t("adm2.courses.pr.sigInstructor")}${q.verifiedByName ? ` (${q.verifiedByName})` : ""}`]} />
      </PrintSheet>
    </PrintShell>
  );
}
