"use client";

import { RefreshCw, Square, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { deleteLiveBoardAction, endLiveBoardAction, regenerateLiveTokenAction } from "@/modules/live/actions";

export function LiveBoardActions({ id, title, active }: { id: string; title: string; active: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton
        variant="secondary"
        action={() => regenerateLiveTokenAction(id)}
        refresh
        confirm={{ title: "Neuen Link erstellen?", message: "Der bisherige Link funktioniert danach nicht mehr. Offene Bildschirme zeigen «Link nicht mehr gültig» und müssen den neuen Link öffnen.", confirmLabel: "Neuer Link" }}
      >
        <RefreshCw className="h-4 w-4" /> Neuer Link
      </ActionButton>
      {active ? (
        <ActionButton
          variant="secondary"
          action={() => endLiveBoardAction(id)}
          refresh
          confirm={{ title: "Live-Rangliste beenden?", message: "Die Bildschirme zeigen danach eine Schlussmeldung. Du kannst den Ablauf später wieder verlängern.", confirmLabel: "Beenden" }}
        >
          <Square className="h-4 w-4" /> Jetzt beenden
        </ActionButton>
      ) : null}
      <ActionButton
        variant="ghost"
        className="text-danger"
        action={() => deleteLiveBoardAction(id)}
        confirm={{ title: `«${title}» löschen?`, message: "Der Link wird ungültig. Die Resultate bleiben erhalten.", tone: "danger", confirmLabel: "Löschen" }}
      >
        <Trash2 className="h-4 w-4" /> Löschen
      </ActionButton>
    </div>
  );
}
