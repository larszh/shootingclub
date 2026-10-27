import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="animate-fade space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-64" />
      <div className="grid gap-3 sm:grid-cols-2 mt-6">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}
