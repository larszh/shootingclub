import { Badge, Card, PageHeader, TargetIllustration } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";

/** Platzhalter für Module, die noch in Vorbereitung sind. */
export async function PlaceholderModule({ title, lead, items, illustration }: { title: string; lead: string; items: string[]; illustration?: React.ReactNode }) {
  const t = getT(await getRequestLocale());
  return (
    <div>
      <PageHeader title={title} subtitle={t("shell.ui.placeholderSubtitle")} />
      <Card className="animate-rise p-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
          <div className="shrink-0">{illustration ?? <TargetIllustration size={88} />}</div>
          <div className="min-w-0">
            <Badge tone="outline">{t("shell.ui.comingSoon")}</Badge>
            <p className="mt-2 text-ink-2">{lead}</p>
          </div>
        </div>
        <ul className="mt-5 space-y-2.5 text-sm text-ink-2">
          {items.map((i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>{i}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
