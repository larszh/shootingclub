"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Search, Sparkles, Upload, X } from "lucide-react";
import { allDictionaryKeys, LOCALE_LABELS, LOCALES, type Locale, type OverrideMap } from "@/lib/i18n/core";
import { Alert, Badge, Button, Card, Input, Select } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/lib/ui-feedback";
import { cn } from "@/lib/utils";
import { removeOrphansAction } from "../actions";
import { dictionaryContext } from "../context";
import { buildRows, filterRows, type Row, type RowFilter } from "../logic";
import { translationsT } from "../texts";
import { CellView } from "./cell";
import { AiDialog } from "./ai-dialog";
import { ImportDialog } from "./import-dialog";

const PAGE_SIZE = 30;

export type ManagerProps = {
  locale: Locale;
  overrides: OverrideMap;
  orphanCount: number;
  ai: { ok: true } | { ok: false; message: string };
};

export function TranslationsManager({ locale, overrides, orphanCount, ai }: ManagerProps) {
  const t = useMemo(() => translationsT(locale), [locale]);
  const router = useRouter();
  const ctx = useMemo(() => dictionaryContext(overrides), [overrides]);
  const keys = useMemo(() => allDictionaryKeys(), []);
  const rows = useMemo(() => buildRows(keys, ctx), [keys, ctx]);
  const namespaces = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.ns, (m.get(r.ns) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [ns, setNs] = useState("");
  const [status, setStatus] = useState<RowFilter["status"]>("all");
  const [statusLocale, setStatusLocale] = useState<Locale>("fr");
  const [visible, setVisible] = useState<Locale[]>([...LOCALES]);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<{ key: string; locale: Locale } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [orphanPending, startOrphans] = useTransition();

  const filtered = useMemo(() => filterRows(rows, { query: deferredQuery, ns, status, locale: statusLocale }), [rows, deferredQuery, ns, status, statusLocale]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const pageRows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const stale = deferredQuery !== query;

  const stats = useMemo(() => {
    const s = {} as Record<Locale, { custom: number; work: number }>;
    for (const l of LOCALES) s[l] = { custom: 0, work: 0 };
    for (const r of rows) for (const l of LOCALES) {
      if (r.cells[l].state === "custom") s[l].custom += 1;
      if (r.cells[l].needsWork) s[l].work += 1;
    }
    return s;
  }, [rows]);

  function resetPage<T>(fn: (v: T) => void) {
    return (v: T) => {
      fn(v);
      setPage(0);
    };
  }

  function toggleVisible(l: Locale) {
    setVisible((v) => (v.includes(l) ? (v.length > 1 ? v.filter((x) => x !== l) : v) : LOCALES.filter((x) => x === l || v.includes(x))));
  }

  function toggleSelect(key: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  function selectPage(on: boolean) {
    setSelected((s) => {
      const n = new Set(s);
      for (const r of pageRows) {
        if (on) n.add(r.key);
        else n.delete(r.key);
      }
      return n;
    });
  }

  function refresh() {
    router.refresh();
  }

  const pageAllSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.key));

  return (
    <div className="space-y-3">
      <Card className="animate-rise p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LOCALES.map((l) => (
            <div key={l} className="rounded-control bg-surface-2 px-3 py-2">
              <p className="text-xs font-medium text-ink-3">{LOCALE_LABELS[l]}</p>
              <p className="text-sm tabular-nums">{t("stats.custom", { n: stats[l].custom })}</p>
              {l !== "de" ? <p className="text-xs tabular-nums text-ink-3">{t("stats.work", { n: stats[l].work })}</p> : <p className="text-xs tabular-nums text-ink-3">{t("stats.keys", { n: rows.length })}</p>}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setAiOpen(true)} disabled={!ai.ok} title={!ai.ok ? ai.message : undefined}>
            <Sparkles className="h-4 w-4" aria-hidden /> {t("ai.button")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" aria-hidden /> {t("import.button")}
          </Button>
          <ExportMenu t={t} />
        </div>
        {!ai.ok ? <p className="mt-2 text-xs text-ink-3">{ai.message}</p> : null}
      </Card>

      {orphanCount > 0 ? (
        <Alert tone="warn" title={t("orphans.title", { n: orphanCount })}>
          <p>{t("orphans.text")}</p>
          <Button
            type="button" variant="secondary" size="sm" className="mt-2 h-11" disabled={orphanPending}
            onClick={() => startOrphans(async () => {
              const res = await removeOrphansAction();
              if (res.ok) {
                toast.success(res.message ?? "");
                refresh();
              } else toast.error(res.error);
            })}
          >
            {orphanPending ? <Spinner /> : null} {t("orphans.remove")}
          </Button>
        </Alert>
      ) : null}

      <Card className="p-3 sm:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input
            type="search" value={query} onChange={(e) => resetPage(setQuery)(e.target.value)} placeholder={t("filter.search")}
            aria-label={t("filter.search")} className="pl-9 pr-10"
          />
          {query ? (
            <button type="button" className="absolute right-0 top-0 grid h-11 w-11 place-items-center text-ink-3" aria-label={t("filter.clear")} onClick={() => resetPage(setQuery)("")}>
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Select value={ns} onChange={(e) => resetPage(setNs)(e.target.value)} aria-label={t("filter.namespace")}>
            <option value="">{t("filter.allNamespaces")}</option>
            {namespaces.map(([n, c]) => (
              <option key={n} value={n}>{n} ({c})</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => resetPage(setStatus)(e.target.value as RowFilter["status"])} aria-label={t("filter.status")}>
            <option value="all">{t("filter.statusAll")}</option>
            <option value="needsWork">{t("filter.statusWork")}</option>
            <option value="custom">{t("filter.statusCustom")}</option>
          </Select>
          <Select
            value={statusLocale} onChange={(e) => resetPage(setStatusLocale)(e.target.value as Locale)} aria-label={t("filter.statusLocale")}
            disabled={status === "all"} className="col-span-2 sm:col-span-1"
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
            ))}
          </Select>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={t("filter.columns")}>
          {LOCALES.map((l) => (
            <button
              key={l} type="button" aria-pressed={visible.includes(l)} onClick={() => toggleVisible(l)}
              className={cn("h-11 min-w-11 rounded-full border px-3 text-sm font-medium", visible.includes(l) ? "border-ink bg-ink text-bg" : "border-line text-ink-3")}
            >
              {l.toUpperCase()}
            </button>
          ))}
          <span className={cn("ml-auto text-sm tabular-nums text-ink-3", stale && "opacity-50")} aria-live="polite">
            {t("filter.count", { n: filtered.length })}
          </span>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={pageAllSelected} onChange={(e) => selectPage(e.target.checked)} />
          {t("select.page")}
        </label>
        {selected.size > 0 ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="tabular-nums">{t("select.count", { n: selected.size })}</span>
            <Button type="button" variant="ghost" size="sm" className="h-11" onClick={() => setSelected(new Set())}>{t("select.clear")}</Button>
          </div>
        ) : null}
      </div>

      {pageRows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-3">{t("list.empty")}</Card>
      ) : (
        <div className={cn("space-y-2", stale && "opacity-60 transition-opacity")}>
          {pageRows.map((r) => (
            <KeyCard
              key={r.key} row={r} visible={visible} selected={selected.has(r.key)} onToggle={() => toggleSelect(r.key)}
              editing={editing?.key === r.key ? editing.locale : null}
              onEdit={(l) => setEditing(l ? { key: r.key, locale: l } : null)}
              onSaved={refresh} t={t}
            />
          ))}
        </div>
      )}

      <nav className="flex items-center justify-between gap-2 pb-4" aria-label={t("list.pages")}>
        <Button type="button" variant="secondary" className="h-11" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label={t("list.prev")}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <span className="text-sm tabular-nums text-ink-3">{t("list.page", { page: current + 1, pages })}</span>
        <Button type="button" variant="secondary" className="h-11" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label={t("list.next")}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </nav>

      {aiOpen ? (
        <AiDialog
          open onClose={() => setAiOpen(false)} t={t} rows={rows} filtered={filtered}
          selected={selected} defaultLocale={status !== "all" && statusLocale !== "de" ? statusLocale : visible.find((l) => l !== "de") ?? "fr"}
          onApplied={refresh}
        />
      ) : null}
      {importOpen ? <ImportDialog open onClose={() => setImportOpen(false)} t={t} ctx={ctx} onApplied={refresh} /> : null}
    </div>
  );
}

function KeyCard({
  row, visible, selected, onToggle, editing, onEdit, onSaved, t,
}: {
  row: Row;
  visible: Locale[];
  selected: boolean;
  onToggle: () => void;
  editing: Locale | null;
  onEdit: (l: Locale | null) => void;
  onSaved: () => void;
  t: ReturnType<typeof translationsT>;
}) {
  return (
    <Card className={cn("overflow-hidden", selected && "border-ink")}>
      <div className="flex items-start gap-1 border-b border-line px-2 py-1">
        <label className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center">
          <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={selected} onChange={onToggle} aria-label={t("select.key", { key: row.key })} />
        </label>
        <p className="min-w-0 flex-1 py-3 font-mono text-xs break-all text-ink-2">{row.key}</p>
        <Badge tone="outline" className="mt-2.5 shrink-0">{row.ns}</Badge>
      </div>
      <div className={cn("grid divide-line", visible.length > 1 ? "sm:grid-cols-2 lg:grid-cols-4" : "", "divide-y sm:divide-y-0")}>
        {visible.map((l) => (
          <CellView
            key={l} rowKey={row.key} locale={l} cell={row.cells[l]} german={row.cells.de.value}
            editing={editing === l} onEdit={(on) => onEdit(on ? l : null)} onSaved={onSaved} t={t}
          />
        ))}
      </div>
    </Card>
  );
}

function ExportMenu({ t }: { t: ReturnType<typeof translationsT> }) {
  const [open, setOpen] = useState(false);
  const link = "flex h-11 flex-1 items-center justify-center rounded-control border border-line text-sm font-medium hover:bg-surface-2";
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" aria-hidden /> {t("export.button")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("export.title")} description={t("export.description")}>
        <div className="divide-y divide-line">
          {LOCALES.map((l) => (
            <div key={l} className="py-2.5">
              <p className="text-sm font-medium">{LOCALE_LABELS[l]}</p>
              <div className="mt-1.5 flex gap-2">
                <a className={link} href={`/api/export/translations?locale=${l}&mode=overrides`} download>{t("export.overrides")}</a>
                <a className={link} href={`/api/export/translations?locale=${l}&mode=all`} download>{t("export.all")}</a>
              </div>
            </div>
          ))}
        </div>
      </Dialog>
    </>
  );
}
