import { Logo } from "@/components/logo";
import { getRequestLocale, getT } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";

// Angemeldete Benutzer leiten die Seiten selbst weiter (sie kennen ?code= und ?next=).
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale();
  const t = getT(locale);
  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="animate-rise flex flex-col items-center mb-8">
            <div className="animate-float"><Logo size={56} /></div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">Standchef</p>
            <p className="text-ink-3 text-sm mt-1">{t("shell.auth.tagline")}</p>
          </div>
          {children}
        </div>
      </main>
      <footer className="pb-6 text-center text-xs text-ink-3 space-y-1 px-4">
        <LanguageSwitcher locale={locale} label={t("shell.auth.language")} />
        <p>{t("shell.auth.footer")}</p>
      </footer>
    </div>
  );
}
