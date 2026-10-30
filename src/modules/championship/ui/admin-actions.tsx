"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CopyPlus, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Switch } from "@/components/ui/controls";
import { toast } from "@/components/ui/toaster";
import { copyChampionshipToNextYearAction, deleteChampionshipAction, setChampionshipPublishedAction } from "@/modules/championship/actions";

/** Veröffentlichen als Schalter (sofort gespeichert). */
export function PublishToggle({ id, published }: { id: string; published: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Switch
      checked={published}
      disabled={pending}
      label="Für Mitglieder veröffentlicht"
      description={published ? "Alle Mitglieder sehen die Rangliste." : "Nur die Verwaltung sieht die Rangliste."}
      onChange={(v) =>
        start(async () => {
          const res = await setChampionshipPublishedAction(id, v);
          if (res.ok) toast.success(res.message ?? "Gespeichert");
          else toast.error(res.error);
          router.refresh();
        })
      }
    />
  );
}

export function ChampionshipAdminButtons({ id, name, year }: { id: string; name: string; year: number }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton
        variant="secondary"
        action={() => copyChampionshipToNextYearAction(id)}
        confirm={{ title: `Für ${year + 1} übernehmen?`, message: "Programme, Kategorien und Reglement werden kopiert. Die neue Meisterschaft ist noch nicht veröffentlicht.", confirmLabel: "Übernehmen" }}
        onSuccess={(res) => {
          const newId = res && res.ok && res.data && typeof res.data === "object" && "id" in res.data ? String((res.data as { id: string }).id) : null;
          if (newId) router.push(`/championship/${newId}/edit`);
        }}
      >
        <CopyPlus className="h-4 w-4" /> Für {year + 1} übernehmen
      </ActionButton>
      <ActionButton
        variant="ghost"
        className="text-danger"
        action={() => deleteChampionshipAction(id)}
        confirm={{ title: `«${name}» löschen?`, message: "Die Meisterschaft und ihre Einstellungen werden gelöscht. Die Resultate der Durchgänge bleiben erhalten.", tone: "danger", confirmLabel: "Löschen" }}
      >
        <Trash2 className="h-4 w-4" /> Löschen
      </ActionButton>
    </div>
  );
}
