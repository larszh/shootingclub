import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/tenant";
import { Alert, Card, PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { aiAvailability } from "@/lib/ai";
import { AiChat } from "@/components/ai/chat";
import { chatStorageKey, SUPPORT_CHAT_STORAGE_KEY } from "@/modules/ai/help/history";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("aihelp.support.title") };
}

/** Support-Assistent für Super-Admins: beantwortet Fragen von Vereinen anhand von Doku und FAQ. */
export default async function SupportAssistantPage() {
  const user = await requireSuperAdmin();
  const t = getT(await getRequestLocale());
  const avail = await aiAvailability("platform", "support", { id: user.id, isSuperAdmin: true, role: null }).catch(() => ({ ok: false as const, reason: "platformOff" as const }));

  return (
    <div>
      <PageHeader title={t("aihelp.support.title")} subtitle={t("aihelp.support.subtitle")} back={{ href: "/super", label: t("aihelp.support.back") }} />
      {avail.ok ? (
        <Card className="animate-rise p-4">
          <AiChat
            endpoint="/api/ai/help/support"
            storageKey={chatStorageKey(SUPPORT_CHAT_STORAGE_KEY, user.id, null)}
            mode="support"
            intro={t("aihelp.support.intro")}
            suggestions={[t("aihelp.support.suggest.payments"), t("aihelp.support.suggest.ai"), t("aihelp.support.suggest.reply")]}
            placeholder={t("aihelp.support.placeholder")}
            className="max-h-[60vh]"
          />
        </Card>
      ) : (
        <Alert tone="info" title={t("aihelp.support.offTitle")}>
          {t(`ai.unavailable.${avail.reason}`)}{" "}
          <Link href="/super/ai" className="font-medium underline underline-offset-2">{t("aihelp.support.settingsLink")}</Link>
        </Alert>
      )}
    </div>
  );
}
