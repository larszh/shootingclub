"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input, Select } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/form";
import { ROLE_LABELS, TENANT_ROLES } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { ACCESS_FILTERS, MEMBER_STATUSES, SORTS, STATUS_LABELS, filtersToQuery, type MemberFilters } from "@/modules/members/types";

export function MemberFilterBar({ filters, categories, households, statusCounts }: {
  filters: MemberFilters;
  categories: Array<{ id: string; name: string }>;
  households: Array<{ id: string; name: string }>;
  statusCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(filters.q);
  const extraCount = [filters.role, filters.cat, filters.hh, filters.access, filters.minor ? "1" : "", filters.sort !== "name" ? "1" : ""].filter(Boolean).length;
  const [open, setOpen] = useState(extraCount > 0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (patch: Partial<MemberFilters>) => {
    if (timer.current) clearTimeout(timer.current);
    start(() => router.push(`/admin/members${filtersToQuery({ ...filters, q, ...patch, page: 1 })}`));
  };
  const onSearch = (value: string) => {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => start(() => router.replace(`/admin/members${filtersToQuery({ ...filters, q: value.trim(), page: 1 })}`)), 450);
  };
  const activeTotal = Object.entries(statusCounts).reduce((s, [k, n]) => (k === "LEFT" ? s : s + n), 0);
  const allTotal = Object.values(statusCounts).reduce((s, n) => s + n, 0);

  return (
    <div className="mb-3 space-y-3">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: q.trim() });
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <Input type="search" value={q} onChange={(e) => onSearch(e.target.value)} placeholder="Name, E-Mail, Nr. oder Lizenz…" className="pl-10 pr-11" aria-label="Mitglieder suchen" />
          {q ? (
            <button type="button" onClick={() => { setQ(""); go({ q: "" }); }} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-ink-3 hover:text-ink" aria-label="Suche leeren"><X className="h-4 w-4" /></button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn("press relative inline-flex h-11 shrink-0 items-center gap-2 rounded-control border px-3.5 text-sm font-medium", open ? "border-ink bg-surface-2" : "border-line bg-surface hover:bg-surface-2")}
        >
          {pending ? <Spinner /> : <SlidersHorizontal className="h-4 w-4" />}
          <span className="hidden sm:inline">Filter</span>
          {extraCount ? <span className="rounded-full bg-accent px-1.5 text-[11px] text-accent-ink tabular-nums">{extraCount}</span> : null}
        </button>
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Nach Status filtern">
        <Chip active={!filters.status} onClick={() => go({ status: "" })}>Aktuelle · {activeTotal}</Chip>
        {MEMBER_STATUSES.filter((s) => statusCounts[s]).map((s) => (
          <Chip key={s} active={filters.status === s} onClick={() => go({ status: filters.status === s ? "" : s })}>{STATUS_LABELS[s]} · {statusCounts[s]}</Chip>
        ))}
        {statusCounts.LEFT ? <Chip active={filters.status === "all"} onClick={() => go({ status: filters.status === "all" ? "" : "all" })}>Alle · {allTotal}</Chip> : null}
      </div>

      {open ? (
        <div className="animate-rise grid gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-2">
          <LabeledSelect label="Rolle" value={filters.role} onChange={(v) => go({ role: v })}>
            <option value="">Alle Rollen</option>
            {TENANT_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </LabeledSelect>
          <LabeledSelect label="Beitragskategorie" value={filters.cat} onChange={(v) => go({ cat: v })}>
            <option value="">Alle Kategorien</option>
            <option value="none">Ohne Kategorie</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </LabeledSelect>
          <LabeledSelect label="Haushalt" value={filters.hh} onChange={(v) => go({ hh: v })}>
            <option value="">Alle</option>
            <option value="any">In einem Haushalt</option>
            <option value="none">Ohne Haushalt</option>
            {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </LabeledSelect>
          <LabeledSelect label="Zugang zur App" value={filters.access} onChange={(v) => go({ access: v })}>
            <option value="">Alle</option>
            {Object.entries(ACCESS_FILTERS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </LabeledSelect>
          <LabeledSelect label="Sortierung" value={filters.sort} onChange={(v) => go({ sort: v as MemberFilters["sort"] })}>
            {Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </LabeledSelect>
          <div className="flex items-end">
            <Switch className="w-full rounded-control border border-line px-3.5 py-2" label="Nur Minderjährige" checked={filters.minor} onChange={(v) => go({ minor: v })} />
          </div>
          {extraCount || filters.status || filters.q ? (
            <button type="button" onClick={() => { setQ(""); start(() => router.push("/admin/members")); }} className="press h-11 rounded-control text-sm font-medium text-ink-2 hover:bg-surface-2 sm:col-span-2">
              Alle Filter zurücksetzen
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LabeledSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>{children}</Select>
    </label>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick}
      className={cn("press h-10 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors", active ? "bg-accent text-accent-ink" : "border border-line bg-surface text-ink-2 hover:bg-surface-2")}>
      {children}
    </button>
  );
}
