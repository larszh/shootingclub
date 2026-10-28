"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui";

/** Teilt den Anlass über das Teilen-Menü des Geräts, sonst wird der Text kopiert. */
export function ShareButton({ title, text, path }: { title: string; text: string; path: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    const full = `${text}\n${url}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(full);
    } catch {
      window.prompt("Text kopieren:", full);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button type="button" variant="secondary" onClick={share} className="flex-1">
      {copied ? <><Check className="h-4 w-4" /> Kopiert</> : <><Share2 className="h-4 w-4" /> Teilen</>}
    </Button>
  );
}
