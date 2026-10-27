"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";

/** Auswahlfeld, das beim Ändern einen Query-Parameter der aktuellen Seite setzt. */
export function QuerySelect({ name, value, options, label, resetParams = [] }: {
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  label: string;
  /** Parameter, die beim Wechsel entfernt werden */
  resetParams?: string[];
}) {
  const router = useRouter();
  return (
    <Select aria-label={label} value={value}
      onChange={(e) => {
        const url = new URL(window.location.href);
        if (e.target.value) url.searchParams.set(name, e.target.value);
        else url.searchParams.delete(name);
        for (const p of resetParams) url.searchParams.delete(p);
        router.push(url.pathname + url.search, { scroll: false });
      }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select>
  );
}
