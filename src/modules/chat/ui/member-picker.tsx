"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getT, type Locale } from "@/lib/i18n/core";
import { tPlural } from "@/modules/billing/ui/i18n";
import type { PickerMember } from "../queries";

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Mitgliederauswahl mit Suche. Einfach (onPick) oder mehrfach (selected/onToggle).
 * Mit `name` werden die gewählten IDs als versteckte Felder ins Formular übernommen.
 */
export function MemberPicker({
  members,
  selected,
  onToggle,
  onPick,
  name,
  emptyText,
  disabled,
  maxHeightClass = "max-h-[55dvh]",
  locale = "de",
}: {
  members: PickerMember[];
  selected?: ReadonlySet<string>;
  onToggle?: (id: string) => void;
  onPick?: (id: string) => void;
  name?: string;
  emptyText?: string;
  disabled?: boolean;
  maxHeightClass?: string;
  locale?: Locale;
}) {
  const t = getT(locale);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const searchId = useId();
  const multi = !!onToggle;
  const filtered = useMemo(() => {
    const q = normalize(deferred.trim());
    if (!q) return members;
    return members.filter((m) => normalize(m.name).includes(q));
  }, [members, deferred]);

  return (
    <div>
      <label htmlFor={searchId} className="sr-only">{t("money.chat.picker.searchLabel")}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("money.chat.picker.search")} className="pl-10" autoComplete="off" enterKeyHint="search" />
      </div>
      {multi && selected && selected.size > 0 ? <p className="mt-2 text-sm text-ink-3" aria-live="polite">{tPlural(t, "money.chat.picker.selected", selected.size)}</p> : null}
      {members.length === 0 ? (
        <p className="mt-4 text-sm text-ink-3">{emptyText ?? t("money.chat.picker.empty")}</p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-ink-3">{t("money.chat.picker.noneFound")}</p>
      ) : (
        <ul className={cn("mt-2 -mx-2 overflow-y-auto overscroll-contain", maxHeightClass)} aria-label={t("money.chat.members")}>
          {filtered.map((m) => {
            const on = !!selected?.has(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => (multi ? onToggle?.(m.id) : onPick?.(m.id))}
                  aria-pressed={multi ? on : undefined}
                  className="press flex min-h-14 w-full items-center gap-3 rounded-control px-2 py-2 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                >
                  <Avatar name={m.name} src={m.avatarUrl} size={40} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{m.name}</span>
                  {multi ? (
                    <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2", on ? "border-accent bg-accent text-accent-ink" : "border-line")} aria-hidden>
                      {on ? <Check className="h-4 w-4" /> : null}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {name && selected ? [...selected].map((id) => <input key={id} type="hidden" name={name} value={id} />) : null}
    </div>
  );
}
