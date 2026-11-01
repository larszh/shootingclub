"use client";

import { startTransition, useActionState, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { deleteAccountAction } from "./actions";
import { Alert, Card, Field } from "@/components/ui";
import { PasswordInput } from "@/components/ui/controls";
import { SubmitButton } from "@/components/ui/form";
import { confirmDialog } from "@/components/ui/dialog";
import { buttonClasses } from "@/components/ui";
import { cn } from "@/lib/utils";

export function ExportCard() {
  return (
    <Card className="animate-rise p-4">
      <p className="text-sm text-ink-2">
        Du erhältst eine ZIP-Datei mit allen Daten, die Standchef zu dir speichert: Profil, Mitgliedschaften, Resultate, Reservationen, Rechnungen (Beiträge, Reservationen, Munition), Anmeldungen zu Anlässen, deine Chat-Nachrichten, die Liste deiner Dateien, Standbesuche und betreute Gäste, akzeptierte Standordnungen, Qualifikationen, Kurse, Waffenausleihen, Helfereinsätze und Arbeitsstunden, gemeldete Vorfälle, Standdienste und deine Konsumationen in der Schützenstube.
      </p>
      <a href="/api/export/me" download className={cn(buttonClasses("secondary", "md"), "mt-3 w-full sm:w-auto")}>
        <Download className="h-4 w-4" /> Meine Daten herunterladen
      </a>
    </Card>
  );
}

export function DeleteAccountCard({ blockers }: { blockers: string[] }) {
  const [state, formAction, pending] = useActionState(deleteAccountAction, null);
  const [open, setOpen] = useState(false);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  if (blockers.length) {
    return (
      <Card className="animate-rise p-4">
        <Alert tone="warn" title="Löschen im Moment nicht möglich">
          Du bist einzige Inhaberin bzw. einziger Inhaber von {blockers.map((b) => `«${b}»`).join(", ")}. Ohne Inhaber könnte niemand mehr den Verein verwalten.
          Bitte mache zuerst eine andere Person unter Verwaltung → Mitglieder zur Inhaberin bzw. zum Inhaber, oder bitte den Standchef-Support, den Verein zu löschen.
        </Alert>
      </Card>
    );
  }

  if (!open) {
    return (
      <Card className="animate-rise p-4">
        <p className="text-sm text-ink-2">Dein Konto wird gelöscht und du wirst abgemeldet. Das lässt sich nicht rückgängig machen.</p>
        <button type="button" onClick={() => setOpen(true)} className={cn(buttonClasses("secondary", "md"), "mt-3 w-full sm:w-auto text-danger")}>
          <Trash2 className="h-4 w-4" /> Konto löschen …
        </button>
      </Card>
    );
  }

  return (
    <Card className="animate-rise p-4 border-danger/40">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const ok = await confirmDialog({ title: "Konto endgültig löschen?", message: "Du wirst sofort abgemeldet und kannst dich nicht mehr anmelden.", tone: "danger", confirmLabel: "Endgültig löschen" });
          if (ok) startTransition(() => formAction(fd));
        }}
        className="space-y-3"
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>Name, E-Mail-Adresse, Telefon, Adresse, Geburtsdatum und Profilbild werden entfernt.</li>
          <li>Alle Geräte werden abgemeldet, Benachrichtigungen und Chat-Mitgliedschaften gelöscht.</li>
          <li>Deine Mitgliedschaften enden heute.</li>
          <li>Rechnungen, Reservationen und Resultate bleiben beim Verein (gesetzliche Aufbewahrung 10 Jahre), erscheinen aber als «Gelöschtes Mitglied».</li>
        </ul>
        <Field label="Dein Passwort" error={errors.password}>
          <PasswordInput name="password" autoComplete="current-password" required maxLength={191} />
        </Field>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" name="confirm" className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-danger)]" required />
          <span>Ich habe verstanden, dass mein Konto endgültig gelöscht wird.</span>
        </label>
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={() => setOpen(false)} className={buttonClasses("secondary", "md")}>Abbrechen</button>
          <SubmitButton variant="danger" pending={pending} pendingText="Wird gelöscht…">Konto endgültig löschen</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
