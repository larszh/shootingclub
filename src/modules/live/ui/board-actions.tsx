"use client";

import { RefreshCw, Square, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { deleteLiveBoardAction, endLiveBoardAction, regenerateLiveTokenAction } from "@/modules/live/actions";
import { useT } from "@/components/locale";

export function LiveBoardActions({ id, title, active }: { id: string; title: string; active: boolean }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton
        variant="secondary"
        action={() => regenerateLiveTokenAction(id)}
        refresh
        confirm={{ title: t("adm2.live.a.newQ"), message: t("adm2.live.a.newText"), confirmLabel: t("adm2.live.a.newLink") }}
      >
        <RefreshCw className="h-4 w-4" /> {t("adm2.live.a.newLink")}
      </ActionButton>
      {active ? (
        <ActionButton
          variant="secondary"
          action={() => endLiveBoardAction(id)}
          refresh
          confirm={{ title: t("adm2.live.a.endQ"), message: t("adm2.live.a.endText"), confirmLabel: t("adm2.live.a.end") }}
        >
          <Square className="h-4 w-4" /> {t("adm2.live.a.endNow")}
        </ActionButton>
      ) : null}
      <ActionButton
        variant="ghost"
        className="text-danger"
        action={() => deleteLiveBoardAction(id)}
        confirm={{ title: t("adm2.live.a.deleteQ", { title }), message: t("adm2.live.a.deleteText"), tone: "danger", confirmLabel: t("adm2.common.delete") }}
      >
        <Trash2 className="h-4 w-4" /> {t("adm2.common.delete")}
      </ActionButton>
    </div>
  );
}
