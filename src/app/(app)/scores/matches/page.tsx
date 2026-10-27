import type { Metadata } from "next";
import { Play } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listMatches } from "@/modules/scores/queries";
import { MatchRow } from "../page";

export const metadata: Metadata = { title: "Durchgänge" };

export default async function MatchesPage() {
  const ctx = await requireModule("scores");
  const matches = await listMatches(ctx, { limit: 100 });
  return (
    <div>
      <PageHeader title="Durchgänge" subtitle={ctx.can("match.viewAll") ? "Alle Durchgänge im Verein" : "Deine Durchgänge und Wettkämpfe"} back={{ href: "/scores", label: "Schiessen" }}
        action={<LinkButton href="/scores/matches/new" size="sm"><Play className="h-4 w-4" /> Starten</LinkButton>} />
      {matches.length ? (
        <div className="stagger space-y-2.5">{matches.map((m) => <MatchRow key={m.id} m={m} />)}</div>
      ) : (
        <EmptyState title="Noch keine Durchgänge" text="Starte dein erstes Programm." action={<LinkButton href="/scores/matches/new" size="sm">Durchgang starten</LinkButton>} />
      )}
    </div>
  );
}
