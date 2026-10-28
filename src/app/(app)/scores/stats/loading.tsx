import { ScoresListSkeleton } from "@/modules/scores/ui/list-skeleton";

/** Ladeansicht nur für diese Liste (Route-Group bzw. Segment ohne [id]-Unterrouten, siehe ScoresListSkeleton). */
export default function Loading() {
  return <ScoresListSkeleton kpis />;
}
