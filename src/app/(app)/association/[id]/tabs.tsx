import { LinkTabs } from "@/components/ui";

/** Navigation im Verbandsbereich. */
export function AssociationTabs({ id, active, pending }: { id: string; active: "overview" | "clubs" | "ranking"; pending?: number }) {
  return (
    <LinkTabs
      className="mb-4 no-print"
      label="Bereich wählen"
      active={active}
      items={[
        { value: "overview", href: `/association/${id}`, label: "Übersicht" },
        { value: "clubs", href: `/association/${id}/clubs`, label: "Vereine", count: pending || undefined },
        { value: "ranking", href: `/association/${id}/ranking`, label: "Rangliste" },
      ]}
    />
  );
}
