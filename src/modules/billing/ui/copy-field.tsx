"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { getT, type Locale } from "@/lib/i18n/core";

/** Wert mit grossem Kopier-Knopf (für E-Banking: IBAN, Referenz, Betrag). */
export function CopyField({ label, value, display, mono = true, locale = "de" }: { label: string; value: string; display?: string; mono?: boolean; locale?: Locale }) {
  const t = getT(locale);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback für ältere Browser
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button type="button" onClick={copy} className="press flex w-full items-center gap-3 rounded-control border border-line bg-surface px-3 py-2.5 text-left hover:bg-surface-2 min-h-14" aria-label={t("money.copy.ariaField", { label })}>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-ink-3">{label}</span>
        <span className={cn("block text-[15px] font-medium break-all", mono && "font-mono tabular-nums")}>{display ?? value}</span>
      </span>
      <span className={cn("flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-medium", copied ? "bg-ok/15 text-ok" : "bg-surface-2 text-ink-2")}>
        {copied ? <><Check className="h-3.5 w-3.5" /> {t("money.copy.copied")}</> : <><Copy className="h-3.5 w-3.5" /> {t("money.copy.copy")}</>}
      </span>
    </button>
  );
}
