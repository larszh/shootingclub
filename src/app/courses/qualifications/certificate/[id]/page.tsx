import { notFound, redirect } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { formatDateZurich } from "@/lib/time";
import { PrintSheet, printedAt, SignatureLines } from "@/modules/ammo/ui/print-sheet";
import { requireCourses } from "@/modules/courses/guard";
import { chDate, dbDay } from "@/modules/courses/logic";
import { getQualificationCertificate } from "@/modules/courses/queries";
import { QUAL_RESPONSIBILITY_HINT } from "@/modules/courses/types";
import { qualificationLabel } from "@/modules/qualifications/types";

export const metadata = { title: "Qualifikationsnachweis" };

/** Qualifikationsnachweis (A4) mit Resultat und Unterschriftslinie der Ausbildnerin bzw. des Ausbildners. */
export default async function QualificationCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCourses();
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
    <PrintShell title="Qualifikationsnachweis" subtitle={`${q.user.name} · ${q.label ?? qualificationLabel(q.kind)}`} action={<PrintButton />}>
      <PrintSheet
        tenantName={ctx.tenant.name}
        title="Qualifikationsnachweis"
        subtitle={q.label ?? qualificationLabel(q.kind)}
        footer={<>Erstellt mit Standchef am {printedAt()}. {QUAL_RESPONSIBILITY_HINT}</>}
      >
        <h2 className="mb-1 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">Person</h2>
        {line("Name", q.user.name)}
        {line("Geburtsdatum", q.user.birthDate ? chDate(dbDay(q.user.birthDate)) : null)}
        {line("Adresse", address)}

        <h2 className="mb-1 mt-5 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">Qualifikation</h2>
        {line("Art", qualificationLabel(q.kind))}
        {line("Bezeichnung", q.label)}
        {line("Gültig ab", from ? chDate(from) : null)}
        {line("Gültig bis", until ? chDate(until) : "unbefristet")}
        {q.number ? line("Nummer", q.number) : null}

        {q.source ? (
          <>
            <h2 className="mb-1 mt-5 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">Qualifikationsschiessen</h2>
            {line("Datum", formatDateZurich(q.source.match.finishedAt ?? q.source.match.date, { weekday: undefined }))}
            {line("Programm", q.source.match.program.name)}
            {line("Resultat", `${q.source.total ?? "–"} Punkte, ${q.source.zeros ?? "–"} Nuller`)}
            {q.requirement ? line("Anforderung", q.requirement) : null}
          </>
        ) : null}
        {q.note ? line("Bemerkung", q.note) : null}

        <h2 className="mb-1 mt-5 text-[9pt] font-semibold uppercase tracking-wide text-neutral-600">Bestätigung</h2>
        {line("Ausbildner:in", q.verifiedByName)}
        {line("Erteilt am", formatDateZurich(q.createdAt, { weekday: undefined }))}
        <SignatureLines labels={["Ort, Datum", `Unterschrift Ausbildner:in${q.verifiedByName ? ` (${q.verifiedByName})` : ""}`]} />
      </PrintSheet>
    </PrintShell>
  );
}
