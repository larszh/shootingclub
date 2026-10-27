import { Card, PageHeader } from "@/components/ui";

export function PlaceholderModule({ title, lead, items }: { title: string; lead: string; items: string[] }) {
  return (
    <div>
      <PageHeader title={title} subtitle="Modul in Vorbereitung" />
      <Card className="animate-rise p-6">
        <p className="text-ink-2">{lead}</p>
        <ul className="mt-4 space-y-2 text-sm text-ink-3">
          {items.map((i) => (
            <li key={i} className="flex gap-2"><span className="text-accent">•</span>{i}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
