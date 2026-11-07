import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Landmark } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getRequestLocale, getT } from "@/lib/i18n";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { listAccessibleAssociations } from "@/modules/association/queries";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.association.title") };
}

/** Einstieg Verbandsbereich: ein Verband → direkt dorthin, mehrere → Auswahl. Unabhängig vom aktiven Verein. */
export default async function AssociationIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const associations = await listAccessibleAssociations(user);
  const t = getT(await getRequestLocale());
  if (associations.length === 1 && !user.isSuperAdmin) redirect(`/association/${associations[0]!.id}`);

  return (
    <div>
      <PageHeader title={t("shell.association.title")} subtitle={t("shell.association.subtitle")} back={{ href: "/me", label: t("shell.nav.more") }} />
      {associations.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-6 w-6" />}
          title={t("shell.association.noAccess")}
          text={user.isSuperAdmin ? t("shell.association.noAccessSuper") : t("shell.association.noAccessText")}
        />
      ) : (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {associations.map((a) => (
            <Link key={a.id} href={`/association/${a.id}`} className="flex items-center gap-3 px-4 py-3 min-h-14 hover:bg-surface-2">
              <Landmark className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{a.name}</div>
                <div className="text-xs text-ink-3">{a.region ? `${a.region} · ` : ""}{t(a.clubCount === 1 ? "shell.association.clubsOne" : "shell.association.clubsMany", { count: a.clubCount })}</div>
              </div>
              <Badge tone="outline">{t(`shell.association.access.${a.access}`)}</Badge>
              <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
