"use client";

import Link from "next/link";
import { parseMarkdownLite, type MdInline } from "@/modules/ai/help/markdown";

/** Inline-Teile: nur Text-Knoten, interne Links (bereinigt) – nie rohes HTML. */
function Inline({ parts, onNavigate }: { parts: MdInline[]; onNavigate?: () => void }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "link" ? (
          <Link key={i} href={p.href} onClick={onNavigate} className="font-medium text-accent underline underline-offset-2">
            {p.text}
          </Link>
        ) : p.kind === "strong" ? (
          <strong key={i}>{p.text}</strong>
        ) : p.kind === "code" ? (
          <code key={i} className="rounded bg-surface-2 px-1 font-mono text-[0.9em] break-all">{p.text}</code>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** Antwort des Assistenten mit «Markdown light» (fett, Listen, Links auf interne Pfade). */
export function MarkdownLite({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const blocks = parseMarkdownLite(text);
  return (
    <div className="space-y-2 break-words">
      {blocks.map((b, i) =>
        b.kind === "h" ? (
          <p key={i} className="font-semibold"><Inline parts={b.parts} onNavigate={onNavigate} /></p>
        ) : b.kind === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((it, j) => <li key={j}><Inline parts={it} onNavigate={onNavigate} /></li>)}
          </ul>
        ) : b.kind === "ol" ? (
          <ol key={i} start={b.start} className="list-decimal space-y-1 pl-5">
            {b.items.map((it, j) => <li key={j}><Inline parts={it} onNavigate={onNavigate} /></li>)}
          </ol>
        ) : (
          <p key={i}>
            {b.lines.map((l, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                <Inline parts={l} onNavigate={onNavigate} />
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
