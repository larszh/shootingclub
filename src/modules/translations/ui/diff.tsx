"use client";

import { useMemo } from "react";
import { wordDiff } from "../logic";

/** Wort-Diff: entfernte Teile durchgestrichen, neue hervorgehoben. */
export function DiffView({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => wordDiff(before, after), [before, after]);
  return (
    <p className="text-sm break-words whitespace-pre-line">
      {parts.map((p, i) =>
        p.type === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.type === "del" ? (
          <del key={i} className="rounded bg-danger/10 text-danger line-through decoration-danger/60">{p.text}</del>
        ) : (
          <ins key={i} className="rounded bg-ok/10 text-ok no-underline">{p.text}</ins>
        ),
      )}
    </p>
  );
}
