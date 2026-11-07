"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CopyPlus, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Switch } from "@/components/ui/controls";
import { toast } from "@/components/ui/toaster";
import { copyChampionshipToNextYearAction, deleteChampionshipAction, setChampionshipPublishedAction } from "@/modules/championship/actions";
import { useT } from "@/components/locale";

/** Veröffentlichen als Schalter (sofort gespeichert). */
export function PublishToggle({ id, published }: { id: string; published: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = useT();
  return (
    <Switch
      checked={published}
      disabled={pending}
      label={t("adm2.champ.adm.published")}
      description={published ? t("adm2.champ.adm.publishedYes") : t("adm2.champ.adm.publishedNo")}
      onChange={(v) =>
        start(async () => {
          const res = await setChampionshipPublishedAction(id, v);
          if (res.ok) toast.success(res.message ?? t("adm2.common.saved"));
          else toast.error(res.error);
          router.refresh();
        })
      }
    />
  );
}

export function ChampionshipAdminButtons({ id, name, year }: { id: string; name: string; year: number }) {
  const router = useRouter();
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton
        variant="secondary"
        action={() => copyChampionshipToNextYearAction(id)}
        confirm={{ title: t("adm2.champ.adm.copyQ", { year: year + 1 }), message: t("adm2.champ.adm.copyText"), confirmLabel: t("adm2.champ.adm.copyConfirm") }}
        onSuccess={(res) => {
          const newId = res && res.ok && res.data && typeof res.data === "object" && "id" in res.data ? String((res.data as { id: string }).id) : null;
          if (newId) router.push(`/championship/${newId}/edit`);
        }}
      >
        <CopyPlus className="h-4 w-4" /> {t("adm2.champ.adm.copy", { year: year + 1 })}
      </ActionButton>
      <ActionButton
        variant="ghost"
        className="text-danger"
        action={() => deleteChampionshipAction(id)}
        confirm={{ title: t("adm2.champ.adm.deleteQ", { name }), message: t("adm2.champ.adm.deleteText"), tone: "danger", confirmLabel: t("adm2.common.delete") }}
      >
        <Trash2 className="h-4 w-4" /> {t("adm2.common.delete")}
      </ActionButton>
    </div>
  );
}
