import { notFound } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { requireRangeDuty } from "@/modules/range/guard";
import { getActiveRules, getRangeDayDetail } from "@/modules/range/queries";
import { toBoardVisits } from "@/modules/range/board";
import { dayTitle, flagsLabel, fmtDay, fmtTime, printedAtLabel } from "@/modules/range/format";
import { PrintSheet, PrintTable, SignatureLine } from "@/modules/range/ui/print-sheet";
import { db } from "@/lib/db";

export const metadata = { title: "Standblatt" };

/** Druckbares Standblatt eines Schiesstags. */
export default async function RangeDayPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRangeDuty();
  const { id } = await params;
  const board = await getRangeDayDetail(ctx.tenant.id, id);
  if (!board) notFound();
  const { day } = board;
  const rules = await getActiveRules(ctx.tenant.id);
  const memberIds = day.visits.map((v) => v.userId).filter((x): x is string => !!x);
  const accepted = rules && memberIds.length ? await db.rulesAcceptance.findMany({ where: { rulesId: rules.id, userId: { in: memberIds } }, select: { userId: true } }) : [];
  const visits = toBoardVisits(board, rules?.id ?? null, new Set(accepted.map((a) => a.userId)));
  const guestMeta = new Map(day.visits.map((v) => [v.id, v]));
  const title = `Standblatt ${fmtDay(day.date, { weekday: undefined })}`;

  return (
    <PrintShell title={title} subtitle={dayTitle(day)} action={<PrintButton />}>
      <PrintSheet
        tenantName={ctx.tenant.name}
        title={title}
        subtitle={`${fmtDay(day.date, { weekday: "long", month: "long" })} · ${dayTitle(day)}`}
        footer={<>Erstellt mit Standchef am {printedAtLabel()}. Gäste: nur Name, Jahrgang und Kontakt; keine Ausweisnummern gespeichert.</>}
      >
        <div className="mb-4 grid grid-cols-4 gap-3">
          <div><div className="text-[8pt] uppercase text-neutral-500">Standdienst</div><div className="font-medium">{day.dutyName ?? "–"}</div></div>
          <div><div className="text-[8pt] uppercase text-neutral-500">Geöffnet / geschlossen</div><div className="font-medium">{fmtTime(day.openedAt)} – {day.closedAt ? fmtTime(day.closedAt) : "offen"}</div></div>
          <div><div className="text-[8pt] uppercase text-neutral-500">Besuche</div><div className="font-medium">{visits.length} ({visits.filter((v) => v.isGuest).length} Gäste)</div></div>
          <div><div className="text-[8pt] uppercase text-neutral-500">Halbtage</div><div className="font-medium">{day.closedAt ? flagsLabel(day) : "–"}</div></div>
        </div>
        <PrintTable
          head={["#", "Name", "Zeit", "Bahn", "Disziplin", "Gast / Betreuung", "Vereinswaffe"]}
          rows={visits.map((v, i) => {
            const raw = guestMeta.get(v.id);
            return [
              i + 1,
              <span key="n">{v.name}{v.minor ? " (minderj.)" : ""}</span>,
              `${v.inLabel}–${v.outLabel ?? ""}`,
              v.lane ?? "",
              v.discipline ?? "",
              v.isGuest ? `${raw?.guestBirthYear ? `Jg. ${raw.guestBirthYear}, ` : ""}${v.hostName ?? "–"}${v.guestIdChecked ? ", Ausweis geprüft" : ""}` : "",
              v.weapon?.name ?? "",
            ];
          })}
        />
        {day.notes ? <div className="mt-4"><div className="text-[8pt] uppercase text-neutral-500">Notizen</div><div className="whitespace-pre-line">{day.notes}</div></div> : null}
        <SignatureLine label="Unterschrift Standdienst" />
      </PrintSheet>
    </PrintShell>
  );
}
