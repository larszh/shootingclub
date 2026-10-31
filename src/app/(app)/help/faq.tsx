"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Card, EmptyState, SearchIllustration } from "@/components/ui";
import { Segmented } from "@/components/ui/controls";

export type FaqEntry = { id: string; q: string; a: React.ReactNode; text: string; audience: "member" | "admin" };

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss");
}

/** Durchsuchbares Akkordeon. `text` enthält den durchsuchbaren Klartext der Antwort. */
export function Faq({ entries, isAdmin }: { entries: FaqEntry[]; isAdmin: boolean }) {
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState<"all" | "member" | "admin">("all");

  const filtered = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return entries.filter((e) => {
      if (audience !== "all" && e.audience !== audience) return false;
      if (!terms.length) return true;
      const hay = normalize(`${e.q} ${e.text}`);
      return terms.every((t) => hay.includes(t));
    });
  }, [entries, query, audience]);

  const groups: Array<{ key: "member" | "admin"; title: string }> = [
    { key: "member", title: "Für Mitglieder" },
    { key: "admin", title: "Für Leitung & Vorstand" },
  ];
  const searching = query.trim().length > 0;

  return (
    <div>
      <div className="mb-3">
        <label htmlFor="faq-search" className="sr-only">Hilfe durchsuchen</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            id="faq-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen, z.B. «offline» oder «QR»"
            autoComplete="off"
            enterKeyHint="search"
            className="h-12 w-full rounded-control border border-line bg-surface pl-10 pr-11 text-[15px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Suche leeren"
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {isAdmin ? (
          <Segmented
            className="mt-2"
            size="sm"
            label="Fragen filtern"
            value={audience}
            onChange={setAudience}
            options={[
              { value: "all", label: "Alle" },
              { value: "member", label: "Mitglieder" },
              { value: "admin", label: "Leitung" },
            ]}
          />
        ) : null}
        <p className="sr-only" aria-live="polite">{searching ? `${filtered.length} Treffer` : ""}</p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          illustration={<SearchIllustration size={80} />}
          title="Nichts gefunden"
          text="Versuch es mit einem anderen Wort oder frag deinen Vereinsadmin."
        />
      ) : (
        groups.map((g) => {
          const list = filtered.filter((e) => e.audience === g.key);
          if (!list.length) return null;
          return (
            <section key={g.key} aria-labelledby={`faq-${g.key}`} className="mt-4 first:mt-0">
              <h2 id={`faq-${g.key}`} className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink-3">{g.title}</h2>
              <Card className="divide-y divide-line overflow-hidden">
                {list.map((e) => (
                  // key mit Suchzustand: bei aktiver Suche sind Treffer aufgeklappt.
                  <details key={`${e.id}-${searching ? "s" : "n"}`} id={e.id} open={searching || undefined} className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 text-[15px] font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
                      <span className="flex-1">{e.q}</span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="animate-fade space-y-2 px-4 pb-4 text-[15px] leading-relaxed text-ink-2 [&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
                      {e.a}
                    </div>
                  </details>
                ))}
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}
