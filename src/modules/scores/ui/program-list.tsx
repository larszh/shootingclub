"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DISCIPLINES } from "@/modules/scores/types";
import type { ProgramView } from "@/modules/scores/queries";
import { ProgramCard } from "./program-card";
import { cn } from "@/lib/utils";

export function ProgramList({ programs, showHidden }: { programs: ProgramView[]; showHidden?: boolean }) {
  const [q, setQ] = useState("");
  const [disc, setDisc] = useState<string>("");
  const [onlyFav, setOnlyFav] = useState(false);

  const used = useMemo(() => new Set(programs.map((p) => p.discipline)), [programs]);
  const list = programs.filter((p) =>
    (!disc || p.discipline === disc) &&
    (!onlyFav || p.favorite) &&
    (!q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.description ?? "").toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div>
      <div className="animate-fade relative mb-3">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen…" className="w-full h-11 rounded-control border border-line bg-surface pl-10 pr-3.5 text-[15px] focus:outline-none focus:border-ink" />
      </div>
      <div className="animate-fade flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 mb-2 [scrollbar-width:none]">
        <Chip active={onlyFav} onClick={() => setOnlyFav((v) => !v)}>★ Favoriten</Chip>
        <Chip active={!disc} onClick={() => setDisc("")}>Alle</Chip>
        {DISCIPLINES.filter((d) => used.has(d.key)).map((d) => (
          <Chip key={d.key} active={disc === d.key} onClick={() => setDisc(d.key)}>{d.label}</Chip>
        ))}
      </div>
      <div className="stagger grid gap-2.5 sm:grid-cols-2">
        {list.map((p) => <ProgramCard key={p.id} program={p} href={`/scores/programs/${p.id}`} showHidden={showHidden} />)}
      </div>
      {list.length === 0 ? <p className="text-sm text-ink-3 text-center py-8">Nichts gefunden.</p> : null}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("press shrink-0 h-9 rounded-full px-3.5 text-sm font-medium border transition-colors", active ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2")}>
      {children}
    </button>
  );
}
