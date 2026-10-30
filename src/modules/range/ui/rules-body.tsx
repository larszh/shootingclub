import { parseRules, type Inline } from "@/modules/range/rules-format";
import { cn } from "@/lib/utils";

function Parts({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) => (p.bold ? <strong key={i} className="font-semibold text-ink">{p.text}</strong> : <span key={i}>{p.text}</span>))}
    </>
  );
}

/** Standordnung als lesbarer Text («Markdown light», ohne HTML). Für App und Druck. */
export function RulesBody({ body, className }: { body: string; className?: string }) {
  const blocks = parseRules(body);
  return (
    <div className={cn("space-y-3 text-[15px] leading-relaxed text-ink-2", className)}>
      {blocks.map((b, i) => {
        if (b.type === "h1") return <h2 key={i} className="pt-1 text-lg font-semibold text-ink"><Parts parts={b.parts} /></h2>;
        if (b.type === "h2") return <h3 key={i} className="pt-1 font-semibold text-ink"><Parts parts={b.parts} /></h3>;
        if (b.type === "p") return <p key={i}><Parts parts={b.parts} /></p>;
        if (b.type !== "ul" && b.type !== "ol") return null;
        const List = b.type === "ul" ? "ul" : "ol";
        return (
          <List key={i} className={cn("space-y-1 pl-5", b.type === "ul" ? "list-disc" : "list-decimal")}>
            {b.items.map((it, j) => <li key={j}><Parts parts={it} /></li>)}
          </List>
        );
      })}
    </div>
  );
}
