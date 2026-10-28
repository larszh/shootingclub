import { Skeleton } from "@/components/ui";

/**
 * Ladeansicht nur für die Scheibenliste. Liegt bewusst in der Route-Group (list),
 * damit sie nicht /targets/[id] umschliesst: dort soll notFound() vor dem Streaming
 * laufen und ein echtes HTTP 404 liefern.
 */
export default function Loading() {
  return (
    <div className="animate-fade" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Wird geladen…</span>
      <div className="mb-5 flex items-center gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-8 w-44 max-w-full" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        <Skeleton className="h-9 w-24 shrink-0 rounded-control" />
      </div>
      <Skeleton className="mb-3 h-11 w-full rounded-control" />
      <div className="mb-3 flex gap-1.5 overflow-hidden">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11 w-24 shrink-0 rounded-full" />)}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={i >= 4 ? "hidden sm:block" : undefined}>
            <Skeleton className="aspect-[210/297] w-full rounded-card" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
