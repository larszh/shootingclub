"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, Search, Square, Star, X } from "lucide-react";
import type { TargetView } from "@/modules/targets/queries";
import { TARGET_CATEGORIES, subjectCategory, subjectLabel, type TargetCategory } from "@/modules/targets/types";
import { Input, Select } from "@/components/ui";
import { TargetCard } from "./target-card";
import { cn } from "@/lib/utils";

export type GalleryScope = "all" | "global" | "tenant" | "mine";
type Scope = GalleryScope;
export type GalleryFilters = { cat: TargetCategory | "all"; q: string; scope: Scope; onlyFav: boolean };

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Kategorie einer Scheibe: eigene Uploads und eigene Vorlagen landen unter «Eigene». */
function categoryOf(t: TargetView): TargetCategory {
  if (t.subject === "UPLOAD" || t.scope === "mine") return "custom";
  return subjectCategory(t.subject);
}

export function TargetGallery({ targets, initial }: { targets: TargetView[]; initial?: Partial<GalleryFilters> }) {
  const [cat, setCatState] = useState<TargetCategory | "all">(initial?.cat ?? "all");
  const [q, setQState] = useState(initial?.q ?? "");
  const [scope, setScopeState] = useState<Scope>(initial?.scope ?? "all");
  const [onlyFav, setOnlyFavState] = useState(initial?.onlyFav ?? false);
  const [favFirst, setFavFirst] = useState(true);
  const [large, setLarge] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of targets) m.set(categoryOf(t), (m.get(categoryOf(t)) ?? 0) + 1);
    return m;
  }, [targets]);

  const list = useMemo(() => {
    const needle = norm(q.trim());
    const filtered = targets.filter((t) => {
      if (cat !== "all" && categoryOf(t) !== cat) return false;
      if (scope !== "all" && t.scope !== scope) return false;
      if (onlyFav && !t.favorite) return false;
      if (needle && !norm(`${t.name} ${t.description ?? ""} ${subjectLabel(t.subject)}`).includes(needle)) return false;
      return true;
    });
    if (!favFirst) return filtered;
    // Stabil sortieren: Favoriten zuerst, sonst Reihenfolge beibehalten
    return filtered.map((t, i) => ({ t, i })).sort((a, b) => Number(b.t.favorite) - Number(a.t.favorite) || a.i - b.i).map((x) => x.t);
  }, [targets, cat, scope, onlyFav, favFirst, q]);

  // Filter in der URL halten, damit sie nach «Zurück» erhalten bleiben
  function setFilters(next: Partial<GalleryFilters>) {
    const f: GalleryFilters = { cat, q, scope, onlyFav, ...next };
    if (next.cat !== undefined) setCatState(next.cat);
    if (next.q !== undefined) setQState(next.q);
    if (next.scope !== undefined) setScopeState(next.scope);
    if (next.onlyFav !== undefined) setOnlyFavState(next.onlyFav);
    try {
      const qs = new URLSearchParams();
      if (f.cat !== "all") qs.set("cat", f.cat);
      if (f.q) qs.set("q", f.q);
      if (f.scope !== "all") qs.set("scope", f.scope);
      if (f.onlyFav) qs.set("fav", "1");
      const s = qs.toString();
      window.history.replaceState(window.history.state, "", s ? `?${s}` : window.location.pathname);
    } catch {
      /* URL-Update ist nur Komfort */
    }
  }
  const setCat = (v: TargetCategory | "all") => setFilters({ cat: v });
  const setQ = (v: string) => setFilters({ q: v });
  const setScope = (v: Scope) => setFilters({ scope: v });

  const chip = (active: boolean) =>
    cn("press shrink-0 h-10 rounded-full px-3.5 text-sm font-medium border transition-colors inline-flex items-center gap-1.5", active ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2");

  return (
    <div>
      <div className="animate-fade relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Scheibe suchen, z.B. «Luftpistole»" aria-label="Scheibe suchen" className="pl-9 pr-10" />
        {q ? (
          <button type="button" onClick={() => setQ("")} aria-label="Suche leeren" className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center text-ink-3 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="animate-fade flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 mb-1 [scrollbar-width:none]" role="group" aria-label="Kategorien">
        <button type="button" aria-pressed={cat === "all"} onClick={() => setCat("all")} className={chip(cat === "all")}>Alle <span className="opacity-60">{targets.length}</span></button>
        {TARGET_CATEGORIES.filter((c) => counts.get(c.key)).map((c) => (
          <button key={c.key} type="button" aria-pressed={cat === c.key} onClick={() => setCat(c.key)} className={chip(cat === c.key)}>
            {c.label} <span className="opacity-60">{counts.get(c.key)}</span>
          </button>
        ))}
      </div>

      <div className="animate-fade flex flex-wrap items-center gap-2 mb-3">
        <button type="button" aria-pressed={onlyFav} onClick={() => setFilters({ onlyFav: !onlyFav })} className={chip(onlyFav)}>
          <Star className={cn("h-4 w-4", onlyFav && "fill-current")} /> Nur Favoriten
        </button>
        <label className="inline-flex items-center gap-2 h-10 text-sm text-ink-2 cursor-pointer select-none">
          <input type="checkbox" checked={favFirst} onChange={(e) => setFavFirst(e.target.checked)} className="h-5 w-5 accent-[var(--ink)]" />
          Favoriten zuerst
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Select value={scope} onChange={(e) => setScope(e.target.value as Scope)} aria-label="Quelle" className="h-10 w-auto text-sm">
            <option value="all">Alle Quellen</option>
            <option value="global">Global</option>
            <option value="tenant">Verein</option>
            <option value="mine">Meine</option>
          </Select>
          <button type="button" onClick={() => setLarge((v) => !v)} aria-pressed={large} title={large ? "Kompakte Ansicht" : "Grosse Vorschau"} aria-label={large ? "Kompakte Ansicht" : "Grosse Vorschau"}
            className="press hidden md:flex h-10 w-10 items-center justify-center rounded-control border border-line bg-surface text-ink-2">
            {large ? <LayoutGrid className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className={cn("stagger grid gap-3", large ? "grid-cols-2 md:grid-cols-2 md:gap-5" : "grid-cols-2 sm:grid-cols-3")}>
        {list.map((t) => <TargetCard key={t.id} target={t} href={`/targets/${t.id}`} />)}
      </div>
      {list.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-ink-3">Nichts gefunden.</p>
          <button type="button" onClick={() => setFilters({ q: "", cat: "all", scope: "all", onlyFav: false })} className="mt-2 text-sm font-medium text-ink underline underline-offset-4">Filter zurücksetzen</button>
        </div>
      ) : null}
    </div>
  );
}
