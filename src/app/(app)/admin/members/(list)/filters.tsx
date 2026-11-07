"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input, Select } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/form";
import { TENANT_ROLES } from "@/lib/permissions";
import { getT, type Locale } from "@/lib/i18n/core";
import { cn } from "@/lib/utils";
import { ACCESS_FILTERS, MEMBER_STATUSES, SORTS, filtersToQuery, type MemberFilters } from "@/modules/members/types";

export function MemberFilterBar({ locale, filters, categories, households, statusCounts }: {
  locale: Locale;
  filters: MemberFilters;
  categories: Array<{ id: string; name: string }>;
  households: Array<{ id: string; name: string }>;
  statusCounts: Record<string, number>;
}) {
  const t = getT(locale);
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
          <Input type="search" value={q} onChange={(e) => onSearch(e.target.value)} placeholder={t("adm1.members.searchPlaceholder")} className="pl-10 pr-11" aria-label={t("adm1.members.searchLabel")} />
          {q ? (
            <button type="button" onClick={() => { setQ(""); go({ q: "" }); }} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-ink-3 hover:text-ink" aria-label={t("adm1.members.searchClear")}><X className="h-4 w-4" /></button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn("press relative inline-flex h-11 shrink-0 items-center gap-2 rounded-control border px-3.5 text-sm font-medium", open ? "border-ink bg-surface-2" : "border-line bg-surface hover:bg-surface-2")}
        >
          {pending ? <Spinner /> : <SlidersHorizontal className="h-4 w-4" />}
          <span className="hidden sm:inline">{t("adm1.members.filter")}</span>
          {extraCount ? <span className="rounded-full bg-accent px-1.5 text-[11px] text-accent-ink tabular-nums">{extraCount}</span> : null}
        </button>
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label={t("adm1.members.filterStatus")}>
        <Chip active={!filters.status} onClick={() => go({ status: "" })}>{t("adm1.members.current")} · {activeTotal}</Chip>
        {MEMBER_STATUSES.filter((s) => statusCounts[s]).map((s) => (
          <Chip key={s} active={filters.status === s} onClick={() => go({ status: filters.status === s ? "" : s })}>{t(`members.status.${s}`)} · {statusCounts[s]}</Chip>
        ))}
        {statusCounts.LEFT ? <Chip active={filters.status === "all"} onClick={() => go({ status: filters.status === "all" ? "" : "all" })}>{t("adm1.common.all")} · {allTotal}</Chip> : null}
      </div>

      {open ? (
        <div className="animate-rise grid gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-2">
          <LabeledSelect label={t("adm1.members.role")} value={filters.role} onChange={(v) => go({ role: v })}>
            <option value="">{t("adm1.members.allRoles")}</option>
            {TENANT_ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
          </LabeledSelect>
          <LabeledSelect label={t("adm1.members.feeCategory")} value={filters.cat} onChange={(v) => go({ cat: v })}>
            <option value="">{t("adm1.members.allCategories")}</option>
            <option value="none">{t("adm1.members.noCategory")}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </LabeledSelect>
          <LabeledSelect label={t("adm1.members.household")} value={filters.hh} onChange={(v) => go({ hh: v })}>
            <option value="">{t("adm1.common.all")}</option>
            <option value="any">{t("adm1.members.inHousehold")}</option>
            <option value="none">{t("adm1.members.noHousehold")}</option>
            {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </LabeledSelect>
          <LabeledSelect label={t("adm1.members.appAccess")} value={filters.access} onChange={(v) => go({ access: v })}>
            <option value="">{t("adm1.common.all")}</option>
            {Object.keys(ACCESS_FILTERS).map((k) => <option key={k} value={k}>{t(`adm1.members.access.${k}`)}</option>)}
          </LabeledSelect>
          <LabeledSelect label={t("adm1.members.sort")} value={filters.sort} onChange={(v) => go({ sort: v as MemberFilters["sort"] })}>
            {Object.keys(SORTS).map((k) => <option key={k} value={k}>{t(`adm1.members.sort.${k}`)}</option>)}
          </LabeledSelect>
          <div className="flex items-end">
            <Switch className="w-full rounded-control border border-line px-3.5 py-2" label={t("adm1.members.minorsOnly")} checked={filters.minor} onChange={(v) => go({ minor: v })} />
          </div>
          {extraCount || filters.status || filters.q ? (
            <button type="button" onClick={() => { setQ(""); start(() => router.push("/admin/members")); }} className="press h-11 rounded-control text-sm font-medium text-ink-2 hover:bg-surface-2 sm:col-span-2">
              {t("adm1.members.resetFilters")}
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
