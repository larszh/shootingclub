"use client";

import { ListSkeleton, Skeleton } from "@/components/ui";
import { useT } from "@/components/locale";

/** Ladeansicht für Bundesübungen und Schiessnachweis. */
export default function Loading() {
  const t = useT();
  return (
    <div aria-busy="true" aria-label={t("shooting.federal.loading")}>
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-6 h-4 w-64" />
      <ListSkeleton rows={5} />
    </div>
  );
}
