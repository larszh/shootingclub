import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Landmark } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ASSOCIATION_ADMIN_ROLE_LABELS } from "@/modules/association/access";
import { listAccessibleAssociations } from "@/modules/association/queries";

export const metadata: Metadata = { title: "Verband" };

/** Einstieg Verbandsbereich: ein Verband → direkt dorthin, mehrere → Auswahl. Unabhängig vom aktiven Verein. */
export default async function AssociationIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const associations = await listAccessibleAssociations(user);
  if (associations.length === 1 && !user.isSuperAdmin) redirect(`/association/${associations[0]!.id}`);

  return (
    <div>
      <PageHeader title="Verband" subtitle="Auswertungen über die Vereine eines Verbands" back={{ href: "/me", label: "Mehr" }} />
      {associations.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-6 w-6" />}
          title="Kein Verbandszugang"
          text={user.isSuperAdmin ? "Lege unter Verwaltung → Verbände einen Verband an." : "Den Zugang zum Verbandsbereich vergibt die Plattform-Verwaltung."}
        />
      ) : (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {associations.map((a) => (
            <Link key={a.id} href={`/association/${a.id}`} className="flex items-center gap-3 px-4 py-3 min-h-14 hover:bg-surface-2">
              <Landmark className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{a.name}</div>
                <div className="text-xs text-ink-3">{a.region ? `${a.region} · ` : ""}{a.clubCount} Vereine</div>
              </div>
              <Badge tone="outline">{a.access === "SUPER" ? "Super-Admin" : ASSOCIATION_ADMIN_ROLE_LABELS[a.access]}</Badge>
              <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
