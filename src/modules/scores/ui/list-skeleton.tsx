import { Skeleton } from "@/components/ui";

/**
 * Ladeansicht für die Listen im Bereich Schiessen (Übersicht, Programme, Durchgänge,
 * Rangliste, Statistik). Wird nur von loading.tsx in Segmenten ohne dynamische
 * Unterrouten verwendet, damit notFound() in /scores/…/[id] vor dem Streaming läuft
 * und ein echtes HTTP 404 liefert.
 */
export function ScoresListSkeleton({ tiles = false, kpis = false }: { tiles?: boolean; kpis?: boolean }) {
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
      {tiles ? (
        <div className="mb-5 grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-card" />)}
        </div>
      ) : null}
      {kpis ? (
        <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-card" />)}
        </div>
      ) : null}
      <div className="space-y-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-10 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
