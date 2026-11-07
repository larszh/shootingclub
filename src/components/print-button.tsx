"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { useT } from "@/components/locale";

export function PrintButton() {
  const t = useT();
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);
  return (
    <button type="button" onClick={() => window.print()} className="press inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white">
      <Printer className="h-4 w-4" /> {t("adm2.common.print")}
    </button>
  );
}
