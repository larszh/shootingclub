import { ListSkeleton } from "@/components/ui";

/** Ladeansicht nur für die Liste (eigene Routengruppe, damit /billing/invoices/[id]/pay und /return echte 404 liefern). */
export default function Loading() {
  return <ListSkeleton />;
}
