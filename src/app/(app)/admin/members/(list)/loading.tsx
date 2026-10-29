import { ListSkeleton } from "@/components/ui";

/** Ladeansicht nur für die Liste (eigene Routengruppe, damit /admin/members/[id] echte 404 liefert). */
export default function Loading() {
  return <ListSkeleton rows={6} />;
}
