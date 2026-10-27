"use client";

import { usePathname, useRouter } from "next/navigation";

export function YearSelect({ year, years }: { year: number; years: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <select value={year} onChange={(e) => router.push(`${pathname}?year=${e.target.value}`)} className="h-9 rounded-control border border-line bg-surface px-2 text-sm">
      {years.map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}
