"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, inputClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getT, type Locale } from "@/lib/i18n/core";

export function CopyField({ value, label = "Link", locale = "de" }: { value: string; label?: string; locale?: Locale }) {
  const t = getT(locale);
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("money.share.copyLinkPrompt"), value);
    }
  }
  return (
    <div className="flex gap-2">
      <input readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} className={cn(inputClass, "min-w-0 flex-1 font-mono text-xs")} />
      <Button type="button" variant="secondary" onClick={copy} aria-label={t("money.copy.copy")} className="shrink-0">
        {copied ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}
        <span className="hidden sm:inline">{copied ? t("money.copy.copied") : t("money.copy.copy")}</span>
      </Button>
    </div>
  );
}
