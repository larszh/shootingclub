import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return (
    <div className="min-h-dvh flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="animate-rise flex flex-col items-center mb-8">
            <div className="animate-float"><Logo size={56} /></div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Mouche</h1>
            <p className="text-ink-3 text-sm mt-1">Schiesssport. Punkt für Punkt.</p>
          </div>
          {children}
        </div>
      </div>
      <p className="text-center text-xs text-ink-3 pb-6">Für Schiessvereine und Schiessanlagen in der Schweiz.</p>
    </div>
  );
}
