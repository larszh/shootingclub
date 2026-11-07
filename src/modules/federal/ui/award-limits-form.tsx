"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Alert, Button, Field, Textarea } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { saveAwardLimitsAction } from "@/modules/federal/actions";
import { AWARD_FORMAT_HINT, AWARD_LIMITS_HINT } from "@/modules/federal/awards";

type Props = {
  programId: string;
  year: number;
  /** Gespeicherte Limiten als Text (leer = noch keine) */
  text: string;
  /** Vorschlag, wenn noch nichts gespeichert ist: Vorjahr oder Beispiel */
  suggestion: { text: string; label: string } | null;
  max: number | null;
};

/** Limitentabelle eines Feldschiessen-Programms bearbeiten (Freitext, eine Zeile pro Limite). */
export function AwardLimitsForm({ programId, year, text, suggestion, max }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveAwardLimitsAction, null);
  // Vorschlag einfügen: Textfeld mit neuem Startwert neu aufbauen (Feld bleibt unkontrolliert).
  const [draft, setDraft] = useState({ value: text, key: 0 });
  const err = state && !state.ok ? state.fieldErrors?.text : undefined;

  useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? "Gespeichert.");
    router.refresh();
  }, [state, router]);

  function applySuggestion() {
    if (suggestion) setDraft((d) => ({ value: suggestion.text, key: d.key + 1 }));
  }

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-3">
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="year" value={year} />
      <Field label={`Limiten ${year}`} hint={`${AWARD_FORMAT_HINT}${max ? ` Maximum des Programms: ${max}.` : ""}`} error={err}>
        <Textarea
          key={draft.key}
          autoFocus={draft.key > 0}
          name="text"
          defaultValue={draft.value}
          rows={Math.min(14, Math.max(5, draft.value.split("\n").length + 1))}
          maxLength={20_000}
          spellCheck={false}
          className="font-mono text-sm"
          placeholder={"Elite;21;59;…;Kranz\nElite;21;59;…;Anerkennungskarte"}
        />
      </Field>
      <p className="text-xs text-ink-3">{AWARD_LIMITS_HINT} Die App hinterlegt keine offiziellen Werte. Alter nach Jahrgang (Jahr minus Geburtsjahr); ohne Alter gilt die Kategorie für alle.</p>
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <SubmitButton pending={pending} className="h-11" pendingText="Speichern…"><Save className="h-4 w-4" aria-hidden /> Limiten speichern</SubmitButton>
        {suggestion && !text ? (
          <Button type="button" variant="secondary" onClick={applySuggestion} className="h-11">{suggestion.label}</Button>
        ) : null}
      </div>
    </form>
  );
}
