import { notFound } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { requireRangeDuty } from "@/modules/range/guard";
import { getActiveRules, getRangeDayDetail } from "@/modules/range/queries";
import { toBoardVisits } from "@/modules/range/board";
import { dayTitle, flagsLabel, fmtDay, fmtTimeOn, printedAtLabel } from "@/modules/range/format";
import { dbDateKey } from "@/modules/range/logic";
import { PrintSheet, PrintTable, SignatureLine } from "@/modules/range/ui/print-sheet";
import { db } from "@/lib/db";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata() {
  const t = getT(await getRequestLocale());
  return { title: t("adm2.range.dayPrint.metaTitle") };
}

/** Druckbares Standblatt eines Schiesstags. */
export default async function RangeDayPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRangeDuty();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const { id } = await params;
  const board = await getRangeDayDetail(ctx.tenant.id, id);
  if (!board) notFound();
  const { day } = board;
  const rules = await getActiveRules(ctx.tenant.id);
  const memberIds = day.visits.map((v) => v.userId).filter((x): x is string => !!x);
  const accepted = rules && memberIds.length ? await db.rulesAcceptance.findMany({ where: { rulesId: rules.id, userId: { in: memberIds } }, select: { userId: true } }) : [];
  const visits = toBoardVisits(board, rules?.id ?? null, new Set(accepted.map((a) => a.userId)));
  const guestMeta = new Map(day.visits.map((v) => [v.id, v]));
  const title = t("adm2.range.dayPrint.title", { date: fmtDay(day.date, { weekday: undefined }, locale) });

  return (
    <PrintShell title={title} subtitle={dayTitle(day, t)} action={<PrintButton />}>
      <PrintSheet
        tenantName={ctx.tenant.name}
        title={title}
        subtitle={`${fmtDay(day.date, { weekday: "long", month: "long" }, locale)} · ${dayTitle(day, t)}`}
        footer={<>{t("adm2.common.createdWith", { date: printedAtLabel(locale) })} {t("adm2.range.dayPrint.footer")}</>}
      >
        <div className="mb-4 grid grid-cols-4 gap-3">
          <div><div className="text-[8pt] uppercase text-neutral-500">{t("adm2.range.dayPrint.duty")}</div><div className="font-medium">{day.dutyName ?? "–"}</div></div>
          <div><div className="text-[8pt] uppercase text-neutral-500">{t("adm2.range.dayPrint.openClose")}</div><div className="font-medium">{fmtTimeOn(day.openedAt, dbDateKey(day.date))} – {day.closedAt ? fmtTimeOn(day.closedAt, dbDateKey(day.date)) : t("adm2.range.dayPrint.open")}</div></div>
          <div><div className="text-[8pt] uppercase text-neutral-500">{t("adm2.range.dayPrint.visits")}</div><div className="font-medium">{t("adm2.range.dayPrint.visitsGuests", { n: visits.length, guests: visits.filter((v) => v.isGuest).length })}</div></div>
          <div><div className="text-[8pt] uppercase text-neutral-500">{t("adm2.range.dayPrint.halfDays")}</div><div className="font-medium">{day.closedAt ? flagsLabel(day, t) : "–"}</div></div>
        </div>
        <PrintTable
          head={["#", t("adm2.range.dayPrint.colName"), t("adm2.range.dayPrint.colTime"), t("adm2.range.dayPrint.colLane"), t("adm2.range.dayPrint.colDiscipline"), t("adm2.range.dayPrint.colGuest"), t("adm2.range.dayPrint.colWeapon")]}
          rows={visits.map((v, i) => {
            const raw = guestMeta.get(v.id);
            return [
              i + 1,
              <span key="n">{v.name}{v.minor ? t("adm2.range.dayPrint.minor") : ""}</span>,
              `${v.inLabel}–${v.outLabel ?? ""}`,
              v.lane ?? "",
              v.discipline ?? "",
              v.isGuest ? `${raw?.guestBirthYear ? t("adm2.range.dayPrint.birthYear", { year: raw.guestBirthYear }) : ""}${v.hostName ?? "–"}${v.guestIdChecked ? t("adm2.range.dayPrint.idChecked") : ""}` : "",
              v.weapon?.name ?? "",
            ];
          })}
        />
        {day.notes ? <div className="mt-4"><div className="text-[8pt] uppercase text-neutral-500">{t("adm2.range.dayPrint.notes")}</div><div className="whitespace-pre-line">{day.notes}</div></div> : null}
        <SignatureLine label={t("adm2.range.dayPrint.signature")} placeLabel={t("adm2.common.placeDate")} />
      </PrintSheet>
    </PrintShell>
  );
}
