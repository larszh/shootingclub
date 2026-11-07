import { notFound } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/core";
import { dayKeyLabel } from "@/lib/i18n/extra/admin2/msg";
import { getClubInfo, getNachweisMember, nowDate, requireFederal } from "@/modules/federal/queries";
import { shootingDaysForUser } from "@/modules/federal/service";
import { dbDateToDay, groupDaysByYear, nachweisRange } from "@/modules/federal/types";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm2.federal.nw.meta") };
}

/**
 * «Bestätigung Schiesstätigkeit / Vereinsmitgliedschaft»: Vereinsdaten, Mitglied, Schiesstage der
 * letzten fünf Jahre und Unterschriftsfelder. Für das eigene Konto oder (members.view) für Mitglieder.
 */
export default async function NachweisPrintPage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const ctx = await requireFederal();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const formatDay = (d: string) => dayKeyLabel(d, locale);
  const formatDbDate = (d: Date | null | undefined) => dayKeyLabel(dbDateToDay(d), locale);
  const sp = await searchParams;
  const targetId = ctx.can("members.view") && sp.userId ? sp.userId.slice(0, 64) : ctx.user.id;
  const member = await getNachweisMember(ctx.tenant.id, targetId);
  if (!member) notFound();
  const now = nowDate();
  const { from, to, fromDay, today } = nachweisRange(now);
  const [days, club] = await Promise.all([shootingDaysForUser(ctx.tenant.id, targetId, from, to), getClubInfo(ctx.tenant.id)]);
  const groups = groupDaysByYear(days);
  const address = [member.street, [member.zip, member.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <PrintShell title={t("adm2.federal.nw.meta")} subtitle={`${member.name} · A4`} action={<PrintButton />}>
      <div className="bg-white text-neutral-900 shadow-lg print:shadow-none flex flex-col" style={{ width: "210mm", minHeight: "297mm", padding: "18mm 18mm 14mm" }}>
        <header className="flex items-start justify-between gap-6">
          <div>
            <div className="text-lg font-semibold">{club.name}</div>
            {club.street ? <div className="text-sm">{club.street}</div> : null}
            {club.zipCity ? <div className="text-sm">{club.zipCity}{club.canton ? ` (${club.canton})` : ""}</div> : null}
            {club.website ? <div className="text-xs text-neutral-600">{club.website}</div> : null}
          </div>
          <div className="text-right text-sm">{club.zipCity ? `${club.zipCity.replace(/^\d+\s*/, "")}, ` : ""}{formatDate(now, locale)}</div>
        </header>

        <h1 className="mt-10 text-xl font-semibold">{t("adm2.federal.nw.title")}</h1>

        <table className="mt-6 text-sm">
          <tbody>
            <tr><td className="pr-6 py-0.5 text-neutral-600">{t("adm2.common.name")}</td><td className="font-medium">{member.name}</td></tr>
            {member.birthDate ? <tr><td className="pr-6 py-0.5 text-neutral-600">{t("adm2.federal.nw.birth")}</td><td>{formatDbDate(member.birthDate)}</td></tr> : null}
            {address ? <tr><td className="pr-6 py-0.5 text-neutral-600">{t("adm2.federal.nw.address")}</td><td>{address}</td></tr> : null}
            {member.memberNumber ? <tr><td className="pr-6 py-0.5 text-neutral-600">{t("adm2.federal.nw.number")}</td><td>{member.memberNumber}</td></tr> : null}
            <tr><td className="pr-6 py-0.5 text-neutral-600">{t("adm2.federal.nw.since")}</td><td>{member.joinedAt ? formatDbDate(member.joinedAt) : "________________"}</td></tr>
            {member.leftAt ? <tr><td className="pr-6 py-0.5 text-neutral-600">{t("adm2.federal.nw.left")}</td><td>{formatDbDate(member.leftAt)}</td></tr> : null}
          </tbody>
        </table>

        <p className="mt-6 text-sm leading-relaxed">
          {t(member.leftAt ? "adm2.federal.nw.textWas" : "adm2.federal.nw.textIs", { from: formatDay(fromDay), to: formatDay(today), n: days.length, days: days.length === 1 ? t("adm2.federal.nw.day") : t("adm2.federal.nw.dayDat") })}
        </p>

        <div className="mt-4 space-y-3 text-sm">
          {groups.length ? groups.map((g) => (
            <div key={g.year} className="break-inside-avoid">
              <div className="font-semibold">{g.year} <span className="font-normal text-neutral-600">({t(g.days.length === 1 ? "adm2.federal.nw.daysN.one" : "adm2.federal.nw.daysN.other", { n: g.days.length })})</span></div>
              <div className="mt-0.5 tabular-nums leading-relaxed">{[...g.days].reverse().map((d) => formatDbDate(d.date)).join(" · ")}</div>
            </div>
          )) : <p className="text-neutral-600">{t("adm2.federal.nw.none")}</p>}
        </div>

        <div className="mt-auto pt-12">
          <div className="grid grid-cols-2 gap-12 text-xs text-neutral-700">
            <div><div className="h-12 border-b border-neutral-500" />{t("adm2.federal.nw.sigPresident")}</div>
            <div><div className="h-12 border-b border-neutral-500" />{t("adm2.federal.nw.sigMaster")}</div>
          </div>
          <div className="mt-6 text-xs text-neutral-700"><div className="h-10 w-1/2 border-b border-neutral-500" />{t("adm2.federal.nw.stamp")}</div>
          <p className="mt-6 text-[10px] leading-snug text-neutral-500">
            {t("adm2.federal.nw.footer")}
          </p>
        </div>
      </div>
    </PrintShell>
  );
}
