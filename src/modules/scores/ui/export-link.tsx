import { Download } from "lucide-react";
import { buttonClasses } from "@/components/ui";

/** Download-Link für CSV-Exporte (normaler Link, damit der Browser die Datei speichert). */
export function ExportLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} download className={buttonClasses("secondary", "sm", className)}>
      <Download className="h-4 w-4" /> {children}
    </a>
  );
}
