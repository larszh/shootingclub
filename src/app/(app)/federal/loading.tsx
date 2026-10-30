import { ListSkeleton, Skeleton } from "@/components/ui";

/** Ladeansicht für Bundesübungen und Schiessnachweis. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Wird geladen">
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-6 h-4 w-64" />
      <ListSkeleton rows={5} />
    </div>
  );
}
