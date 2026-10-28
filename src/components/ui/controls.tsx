"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Check, Copy, Eye, EyeOff, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOnline, getServerOnline, subscribeOnline, toast } from "@/lib/ui-feedback";
import { inputClass } from "./index";

/* ---------------------------------------------------------------- Hooks */

/** true, solange der Browser eine Verbindung meldet (serverseitig immer true). */
export function useOnlineStatus() {
  return useSyncExternalStore(subscribeOnline, getOnline, getServerOnline);
}

/* ------------------------------------------------------------ Segmented */

export type SegmentedOption<T extends string> = { value: T; label: React.ReactNode; icon?: React.ReactNode; disabled?: boolean };

/**
 * Segment-Umschalter (wie iOS). Kontrolliert (value/onChange) oder unkontrolliert
 * (defaultValue). Mit `name` wird der Wert auch in Formularen übertragen.
 */
export function Segmented<T extends string>({
  options,
  value,
  defaultValue,
  onChange,
  name,
  label,
  size = "md",
  className,
}: {
  options: SegmentedOption<T>[];
  value?: T;
  defaultValue?: T;
  onChange?: (v: T) => void;
  name?: string;
  /** Unsichtbare Beschriftung für Screenreader */
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const [inner, setInner] = useState<T | undefined>(defaultValue ?? options[0]?.value);
  const current = value ?? inner;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function select(v: T) {
    if (value === undefined) setInner(v);
    onChange?.(v);
  }

  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    const pos = enabled.indexOf(idx);
    let next = enabled[0]!;
    if (e.key === "ArrowLeft") next = enabled[(pos - 1 + enabled.length) % enabled.length]!;
    if (e.key === "ArrowRight") next = enabled[(pos + 1) % enabled.length]!;
    if (e.key === "End") next = enabled[enabled.length - 1]!;
    select(options[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-grid w-full gap-1 rounded-control bg-surface-2 p-1", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o, i) => {
        const active = o.value === current;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
            onClick={() => select(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-[10px] px-2 font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-40",
              size === "sm" ? "h-8 text-xs" : "h-10 text-sm",
              active ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink",
            )}
          >
            {o.icon}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
      {name ? <input type="hidden" name={name} value={current ?? ""} /> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- Switch */

/**
 * Ein/Aus-Schalter mit role="switch". Mit `name` wird "on"/"" im Formular übertragen
 * (wie eine Checkbox: nur gesetzt, wenn eingeschaltet).
 */
export function Switch({
  checked,
  defaultChecked,
  onChange,
  name,
  label,
  description,
  disabled,
  className,
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
  name?: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const [inner, setInner] = useState(!!defaultChecked);
  const on = checked ?? inner;
  const id = useId();
  const descId = useId();
  return (
    <div className={cn("flex items-center justify-between gap-4", disabled && "opacity-60", className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[15px] font-medium text-ink">{label}</label>
        {description ? <p id={descId} className="text-sm text-ink-3">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        aria-describedby={description ? descId : undefined}
        disabled={disabled}
        onClick={() => {
          if (checked === undefined) setInner(!on);
          onChange?.(!on);
        }}
        className={cn(
          "relative inline-flex h-8 w-13 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          on ? "bg-accent" : "bg-line",
        )}
      >
        <span className={cn("inline-block h-6 w-6 rounded-full bg-white shadow transition-transform", on ? "translate-x-6" : "translate-x-1")} />
      </button>
      {name && on ? <input type="hidden" name={name} value="on" /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------- Tabs */

export type TabItem<T extends string> = { value: T; label: React.ReactNode; count?: number };

/**
 * Tabs mit Zustand (für Inhalte auf derselben Seite). Für Tabs, die zu URLs führen,
 * siehe <LinkTabs> in "@/components/ui".
 *   const [tab, setTab] = useState<"a" | "b">("a");
 *   <Tabs items={[{ value: "a", label: "Offen" }, { value: "b", label: "Erledigt" }]} value={tab} onChange={setTab} />
 *   <TabPanel value="a" current={tab}>…</TabPanel>
 */
export function Tabs<T extends string>({ items, value, onChange, label = "Ansicht wählen", className, idBase }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; label?: string; className?: string; idBase?: string }) {
  const auto = useId();
  const base = idBase ?? auto;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % items.length;
    if (e.key === "ArrowLeft") next = (idx - 1 + items.length) % items.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next]!.value);
    refs.current[next]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className={cn("-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1", className)}>
      {items.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${base}-tab-${t.value}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${base}-panel-${t.value}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative -mb-px inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent",
              active ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {t.label}
            {typeof t.count === "number" ? <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-3")}>{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel<T extends string>({ value, current, idBase, children, className }: { value: T; current: T; idBase?: string; children: React.ReactNode; className?: string }) {
  if (value !== current) return null;
  return (
    <div role="tabpanel" id={idBase ? `${idBase}-panel-${value}` : undefined} aria-labelledby={idBase ? `${idBase}-tab-${value}` : undefined} className={cn("animate-fade pt-4", className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------- CopyButton */

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback für ältere Browser / http
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Kopiert Text in die Zwischenablage, zeigt kurz ein Häkchen und einen Toast. */
export function CopyButton({
  text,
  label = "Kopieren",
  copiedMessage = "Kopiert",
  iconOnly,
  variant = "secondary",
  className,
}: {
  text: string;
  label?: string;
  copiedMessage?: string;
  iconOnly?: boolean;
  variant?: "secondary" | "ghost";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function onClick() {
    const ok = await writeClipboard(text);
    if (!ok) {
      toast.error("Kopieren nicht möglich", { description: "Bitte den Text von Hand markieren." });
      return;
    }
    setCopied(true);
    toast.success(copiedMessage);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  }

  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={cn(
        "press inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        variant === "secondary" ? "border border-line bg-surface hover:bg-surface-2" : "hover:bg-surface-2",
        iconOnly ? "h-10 w-10" : "h-10 px-3",
        copied ? "text-ok" : "text-ink-2",
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {iconOnly ? null : <span>{copied ? "Kopiert" : label}</span>}
      <span className="sr-only" aria-live="polite">{copied ? "In die Zwischenablage kopiert" : ""}</span>
    </button>
  );
}

/* ------------------------------------------------------------ Hint/Tooltip */

/**
 * Tipp-freundlicher Hinweis: (i)-Knopf, der beim Antippen/Klicken eine kleine Blase
 * öffnet. Schliesst mit Escape, Klick daneben oder erneutem Antippen.
 *   <Hint>Der Beitrittscode ist für alle Mitglieder gleich.</Hint>
 */
export function Hint({ children, label = "Mehr erfahren", side = "bottom", className, trigger }: { children: React.ReactNode; label?: string; side?: "top" | "bottom"; className?: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrap} className={cn("relative inline-flex align-middle", className)}>
      <button
        type="button"
        aria-label={trigger ? undefined : label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center justify-center rounded-full text-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent",
          trigger ? "gap-1 text-sm underline decoration-dotted underline-offset-4" : "h-8 w-8 -m-1.5",
        )}
      >
        {trigger ?? <Info className="h-4 w-4" aria-hidden />}
      </button>
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className={cn(
          "absolute left-1/2 z-30 w-64 max-w-[80vw] -translate-x-1/2 rounded-control border border-line bg-surface p-3 text-left text-sm font-normal normal-case tracking-normal text-ink-2 shadow-lg animate-pop",
          side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
        )}
      >
        {children}
      </span>
    </span>
  );
}

/** Kurzform: Tooltip = Hint */
export const Tooltip = Hint;

/* --------------------------------------------------------- PasswordInput */

/**
 * Passwortfeld mit Anzeigen/Verbergen-Knopf und Hinweis bei aktiver Feststelltaste.
 * Alle Input-Props werden durchgereicht (name, autoComplete, required …).
 */
export function PasswordInput({ className, onKeyUp, onKeyDown, onBlur, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const hintId = useId();
  const check = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === "function") setCaps(e.getModifierState("CapsLock"));
  };
  return (
    <div>
      <div className="relative">
        <input
          {...props}
          type={visible ? "text" : "password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={[props["aria-describedby"], caps ? hintId : null].filter(Boolean).join(" ") || undefined}
          className={cn(inputClass, "pr-12", className)}
          onKeyUp={(e) => {
            check(e);
            onKeyUp?.(e);
          }}
          onKeyDown={(e) => {
            check(e);
            onKeyDown?.(e);
          }}
          onBlur={(e) => {
            setCaps(false);
            onBlur?.(e);
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 flex h-9 w-10 -translate-y-1/2 items-center justify-center rounded-[10px] text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      {caps ? (
        <p id={hintId} role="status" className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-warn/10 px-2.5 py-0.5 text-xs font-medium text-warn animate-pop">
          Feststelltaste ist aktiv
        </p>
      ) : null}
    </div>
  );
}
