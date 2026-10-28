import { ListSkeleton } from "@/components/ui";

/** Ladeansicht nur für diese Liste (Segment ohne [id]-Unterrouten, siehe ListSkeleton). */
export default function Loading() {
  return <ListSkeleton />;
}
