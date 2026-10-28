"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DISCIPLINES } from "@/modules/scores/types";
import type { ProgramView } from "@/modules/scores/queries";
import { ProgramCard } from "./program-card";
import { cn } from "@/lib/utils";

type SortKey = "name" | "used";

export function ProgramList({ programs, showHidden, usage = {} }: { programs: ProgramView[]; showHidden?: boolean; /** programId → Anzahl Durchgänge */ usage?: Record<string, number> }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [disc, setDisc] = useState<string>("");
  const [onlyFav, setOnlyFav] = useState(false);

  const used = useMemo(() => new Set(programs.map((p) => p.discipline)), [programs]);
  const needle = q.trim().toLowerCase();
  const list = programs
    .filter((p) =>
      (!disc || p.discipline === disc) &&
      (!onlyFav || p.favorite) &&
      (!needle || p.name.toLowerCase().includes(needle) || (p.description ?? "").toLowerCase().includes(needle)),
    )
    .sort((a, b) =>
      sort === "used"
        ? (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.name.localeCompare(b.name, "de-CH")
        : a.name.localeCompare(b.name, "de-CH"),
    );

  return (
    <div>
      <div className="animate-fade relative mb-3">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen…" aria-label="Programme suchen" type="search" className="w-full h-11 rounded-control border border-line bg-surface pl-10 pr-3.5 text-[15px] focus:outline-none focus:border-ink" />
      </div>
      <div className="animate-fade mb-2 flex items-center gap-2 text-sm">
        <span className="text-ink-3">Sortieren:</span>
        <div className="inline-flex rounded-full border border-line bg-surface p-0.5" role="group" aria-label="Sortierung">
          <SortBtn active={sort === "name"} onClick={() => setSort("name")}>A–Z</SortBtn>
          <SortBtn active={sort === "used"} onClick={() => setSort("used")}>Meistgeschossen</SortBtn>
        </div>
      </div>
      <div className="animate-fade flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 mb-2 [scrollbar-width:none]">
        <Chip active={onlyFav} onClick={() => setOnlyFav((v) => !v)}>★ Favoriten</Chip>
        <Chip active={!disc} onClick={() => setDisc("")}>Alle</Chip>
        {DISCIPLINES.filter((d) => used.has(d.key)).map((d) => (
          <Chip key={d.key} active={disc === d.key} onClick={() => setDisc(d.key)}>{d.label}</Chip>
        ))}
      </div>
      <div className="stagger grid gap-2.5 sm:grid-cols-2">
        {list.map((p) => <ProgramCard key={p.id} program={p} href={`/scores/programs/${p.id}`} showHidden={showHidden} usage={usage[p.id]} />)}
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

function SortBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("press h-8 rounded-full px-3 text-sm font-medium transition-colors", active ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2")}>
      {children}
    </button>
  );
}
