import { Skeleton } from "@/components/ui";

/** Ladeansicht im App-Bereich: grob wie das Dashboard bzw. eine Listenseite. */
export default function Loading() {
  return (
    <div className="animate-fade" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Wird geladen…</span>
      <div className="mb-5 flex items-center gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-56 max-w-full" />
        </div>
        <Skeleton className="h-13 w-13 shrink-0 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="hidden h-20 rounded-card sm:block" />
      </div>
      <Skeleton className="mt-7 mb-2.5 h-3 w-24" />
      <div className="space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-10 shrink-0" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-7 mb-2.5 h-3 w-28" />
      <div className="grid grid-cols-3 gap-2.5">
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-20 rounded-card" />
      </div>
    </div>
  );
}
