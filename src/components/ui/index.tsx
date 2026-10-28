import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-ink text-bg hover:opacity-90 dark:bg-ink dark:text-bg",
  secondary: "bg-surface border border-line text-ink hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
};
const sizeClass: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-[15px] gap-2",
  lg: "h-13 px-6 text-base gap-2",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(
    "press inline-flex items-center justify-center rounded-control font-medium whitespace-nowrap select-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    variantClass[variant],
    sizeClass[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  href,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link href={href} className={buttonClasses(variant, size, className)} {...props} />;
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-card bg-surface border border-line shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)} {...props}>
      {children}
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-sm font-medium text-ink-2 mb-1.5", className)} {...props} />;
}

export const inputClass =
  "w-full h-11 rounded-control border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 disabled:opacity-60";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "h-auto min-h-24 py-2.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputClass, "appearance-none pr-9 bg-[length:16px] bg-[right_12px_center] bg-no-repeat", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238a8884' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>\")" }}
      {...props}>
      {children}
    </select>
  );
}

export { Field } from "./field";

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "accent" | "ok" | "warn" | "danger" | "outline"; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2",
    accent: "bg-accent-soft text-accent",
    ok: "bg-ok/10 text-ok",
    warn: "bg-warn/10 text-warn",
    danger: "bg-danger/10 text-danger",
    outline: "border border-line text-ink-3",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export function PageHeader({ title, subtitle, action, back }: { title: string; subtitle?: string; action?: React.ReactNode; back?: { href: string; label?: string } }) {
  return (
    <div className="animate-fade mb-5">
      {back ? (
        <Link href={back.href} className="-ml-2 -mt-3 -mb-1 inline-flex min-h-11 items-center gap-1 px-2 text-sm text-ink-3 hover:text-ink">
          <span aria-hidden>←</span> {back.label ?? "Zurück"}
        </Link>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight leading-tight">{title}</h1>
          {subtitle ? <p className="text-ink-3 text-sm mt-1">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ icon, illustration, title, text, action, className }: { icon?: React.ReactNode; /** Grössere Strichzeichnung statt Icon, z.B. <TargetIllustration /> */ illustration?: React.ReactNode; title: string; text?: string; action?: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("animate-rise p-8 text-center", className)}>
      {illustration ? <div className="mx-auto mb-4 flex justify-center">{illustration}</div> : icon ? <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-2">{icon}</div> : null}
      <h3 className="font-semibold">{title}</h3>
      {text ? <p className="mt-1 text-sm text-ink-3 max-w-sm mx-auto">{text}</p> : null}
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </Card>
  );
}

export function Alert({ tone = "error", children, title, icon, className }: { tone?: "error" | "ok" | "info" | "warn"; children: React.ReactNode; title?: string; icon?: React.ReactNode; className?: string }) {
  const t = { error: "bg-danger/10 text-danger", ok: "bg-ok/10 text-ok", info: "bg-surface-2 text-ink-2", warn: "bg-warn/10 text-warn" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("animate-pop rounded-control px-3.5 py-2.5 text-sm", icon ? "flex items-start gap-2.5" : null, t, className)}>
      {icon ? <span className="mt-0.5 shrink-0" aria-hidden>{icon}</span> : null}
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2.5 mt-6 first:mt-0">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">{children}</h2>
      {/* Aktions-Link bekommt eine 44px hohe Trefferfläche, ohne die Zeile höher zu machen. */}
      {action ? <div className="-my-3.5 -mr-2 flex shrink-0 items-center *:inline-flex *:min-h-11 *:items-center *:px-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

/**
 * Generische Ladeansicht für Listenseiten. Nur in loading.tsx von Segmenten ohne
 * dynamische Unterrouten verwenden, damit notFound() in …/[id] vor dem Streaming
 * läuft und ein echtes HTTP 404 liefert.
 */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-fade" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Wird geladen…</span>
      <div className="mb-5 min-w-0 space-y-2">
        <Skeleton className="h-8 w-44 max-w-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Neu (UX) */

export * from "./illustrations";

/** Kennzahl-Karte, optional als Link und mit Trend/Hinweis. */
export function StatCard({ label, value, hint, icon, href, tone = "neutral", className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; href?: string; tone?: "neutral" | "accent" | "ok" | "warn"; className?: string }) {
  const toneCls = { neutral: "text-ink", accent: "text-accent", ok: "text-ok", warn: "text-warn" }[tone];
  const body = (
    <Card className={cn("h-full p-4", href && "transition-colors hover:border-ink/30", className)}>
      <div className="flex items-center justify-between gap-2 text-xs text-ink-3">
        <span className="truncate">{label}</span>
        {icon ? <span className="shrink-0 text-ink-3" aria-hidden>{icon}</span> : null}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight", toneCls)}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-ink-3">{hint}</div> : null}
    </Card>
  );
  return href ? <Link href={href} className="press block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{body}</Link> : body;
}

/** Fortschrittsbalken (0–max). Mit label für Screenreader. */
export function ProgressBar({ value, max = 100, label, showValue, tone = "accent", size = "md", className }: { value: number; max?: number; label: string; showValue?: boolean; tone?: "accent" | "ok" | "warn" | "ink"; size?: "sm" | "md"; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const bar = { accent: "bg-accent", ok: "bg-ok", warn: "bg-warn", ink: "bg-ink" }[tone];
  return (
    <div className={className}>
      {showValue ? (
        <div className="mb-1 flex justify-between text-xs text-ink-3">
          <span>{label}</span>
          <span className="tabular-nums">{Math.round(pct)}%</span>
        </div>
      ) : null}
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value * 10) / 10} className={cn("w-full overflow-hidden rounded-full bg-surface-2", size === "sm" ? "h-1.5" : "h-2.5")}>
        <div className={cn("h-full rounded-full transition-[width] duration-500", bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Tabs als Links (z.B. Filter über Suchparameter). Serverseitig nutzbar,
 * aktiver Eintrag über `active` (value).
 *   <LinkTabs active={sp.status ?? "all"} items={[{ value: "all", href: "?", label: "Alle" }, …]} />
 */
export function LinkTabs({ items, active, label = "Ansicht wählen", className }: { items: Array<{ value: string; href: string; label: React.ReactNode; count?: number }>; active: string; label?: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1", className)}>
      {items.map((t) => {
        const on = t.value === active;
        return (
          <Link
            key={t.value}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative -mb-px inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent",
              on ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {t.label}
            {typeof t.count === "number" ? <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-3")}>{t.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Kleine Checkliste mit Fortschritt (z.B. «Erste Schritte»). */
export function ChecklistItem({ done, href, title, text }: { done: boolean; href: string; title: string; text?: string }) {
  return (
    <li>
      <Link href={href} className="press group flex items-center gap-3 rounded-control px-2 py-2.5 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
        <span
          className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold", done ? "border-ok bg-ok text-ok-ink" : "border-line text-transparent")}
          aria-hidden
        >
          ✓
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[15px] font-medium", done && "text-ink-3 line-through decoration-ink-3/50")}>{title}</span>
          {text && !done ? <span className="block text-xs text-ink-3">{text}</span> : null}
        </span>
        <span className="sr-only">{done ? "erledigt" : "offen"}</span>
        <span aria-hidden className="text-ink-3 transition-transform group-hover:translate-x-0.5">→</span>
      </Link>
    </li>
  );
}
