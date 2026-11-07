import { LinkTabs } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";

/** Navigation im Verbandsbereich. */
export async function AssociationTabs({ id, active, pending }: { id: string; active: "overview" | "clubs" | "ranking"; pending?: number }) {
  const t = getT(await getRequestLocale());
  return (
    <LinkTabs
      className="mb-4 no-print"
      label={t("adm2.assoc.tabs.aria")}
      active={active}
      items={[
        { value: "overview", href: `/association/${id}`, label: t("adm2.assoc.tabs.overview") },
        { value: "clubs", href: `/association/${id}/clubs`, label: t("adm2.assoc.tabs.clubs"), count: pending || undefined },
        { value: "ranking", href: `/association/${id}/ranking`, label: t("adm2.assoc.tabs.ranking") },
      ]}
    />
  );
}
