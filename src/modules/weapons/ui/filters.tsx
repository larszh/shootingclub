"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui";

/** Filter für das Inventar: Disziplin (Auswahl) und Suche; Status über die Chips (Links). */
export function WeaponFilters({ disciplines }: { disciplines: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function apply(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.replace(`${pathname}${sp.size ? `?${sp.toString()}` : ""}`);
  }

  return (
    <form
      role="search"
      onSubmit={(e) => { e.preventDefault(); apply({ q: q.trim() }); }}
      className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_14rem]"
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => { if ((params.get("q") ?? "") !== q.trim()) apply({ q: q.trim() }); }} type="search" placeholder="Name, Modell, Kaliber …" aria-label="Waffen suchen" className="pl-9" />
      </div>
      {disciplines.length ? (
        <Select value={params.get("discipline") ?? ""} onChange={(e) => apply({ discipline: e.target.value })} aria-label="Disziplin">
          <option value="">Alle Disziplinen</option>
          {disciplines.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
      ) : null}
    </form>
  );
}
