import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { NotFoundView } from "@/components/ui/not-found-view";

export const metadata: Metadata = { title: "Nicht gefunden" };

export default function NotFound() {
  return (
    <div className="min-h-dvh">
      <div className="flex justify-center pt-10">
        <Link href="/" aria-label="Standchef Startseite" className="inline-flex items-center gap-2 font-semibold tracking-tight">
          <Logo size={32} /> Standchef
        </Link>
      </div>
      <NotFoundView />
    </div>
  );
}
