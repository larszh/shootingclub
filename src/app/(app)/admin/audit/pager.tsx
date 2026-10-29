import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClass, buttonClasses } from "@/components/ui";

/** Liest eine positive Seitenzahl aus den Suchparametern (Standard 1, max. 10'000). */
export function pageParam(raw: string | string[] | undefined): number {
  const v = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(v) && v >= 1 ? Math.min(v, 10_000) : 1;
}

/** Erster Wert eines Suchparameters, gekürzt und getrimmt. */
export function textParam(raw: string | string[] | undefined, max = 100): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (v ?? "").trim().slice(0, max);
}

function hrefWith(base: string, params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) sp.set(k, String(v));
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Vor/Zurück-Navigation für serverseitig geblätterte Listen. */
export function Pager({ base, page, pageSize, total, params }: { base: string; page: number; pageSize: number; total: number; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const linkCls = "h-11 min-w-11 px-3 rounded-control border border-line inline-flex items-center justify-center gap-1 text-sm";
  return (
    <nav className="mt-3 flex items-center justify-between gap-2" aria-label="Seiten">
      {page > 1 ? (
        <Link className={linkCls} href={hrefWith(base, { ...params, page: page - 1 })} rel="prev"><ChevronLeft className="h-4 w-4" /> Zurück</Link>
      ) : <span className={cn(linkCls, "opacity-40")} aria-disabled><ChevronLeft className="h-4 w-4" /> Zurück</span>}
      <span className="text-sm text-ink-3 tabular-nums">Seite {Math.min(page, pages)} von {pages}</span>
      {page < pages ? (
        <Link className={linkCls} href={hrefWith(base, { ...params, page: page + 1 })} rel="next">Weiter <ChevronRight className="h-4 w-4" /></Link>
      ) : <span className={cn(linkCls, "opacity-40")} aria-disabled>Weiter <ChevronRight className="h-4 w-4" /></span>}
    </nav>
  );
}

/** Einfaches GET-Suchformular (funktioniert ohne JavaScript). */
export function SearchForm({ action, name = "q", value, placeholder, hidden }: { action: string; name?: string; value: string; placeholder: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form action={action} method="get" role="search" className="mb-3 flex gap-2">
      {Object.entries(hidden ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <input name={name} defaultValue={value} placeholder={placeholder} aria-label={placeholder} className={cn(inputClass, "flex-1")} type="search" maxLength={100} />
      <button type="submit" className={buttonClasses("secondary", "md")} aria-label="Suchen"><Search className="h-4 w-4" /><span className="hidden sm:inline">Suchen</span></button>
    </form>
  );
}
