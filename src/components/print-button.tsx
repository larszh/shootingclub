"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export function PrintButton() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <button type="button" onClick={() => window.print()} className="press inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white">
      <Printer className="h-4 w-4" /> Drucken
    </button>
  );
}
