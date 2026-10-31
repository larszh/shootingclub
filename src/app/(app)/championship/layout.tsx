import { requireChampionship } from "@/modules/championship/guard";

/** Jahresmeisterschaft: Modul aktiv. Verwaltung mit «championship.manage», Mitglieder sehen veröffentlichte Ranglisten. */
export default async function ChampionshipLayout({ children }: { children: React.ReactNode }) {
  await requireChampionship();
  return <>{children}</>;
}
