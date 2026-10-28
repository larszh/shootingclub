"use client";

import { startTransition } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./index";

/**
 * onSubmit-Handler für Formulare mit useActionState, der die Eingaben behält.
 * Mit <form action={…}> setzt React 19 alle unkontrollierten Felder nach jeder Action
 * zurück – auch wenn der Server nur einen Validierungsfehler meldet. Stattdessen:
 *   const [state, formAction, pending] = useActionState(saveAction, null);
 *   <form onSubmit={submitKeepingValues(formAction)}> … <SubmitButton pending={pending}>
 * Soll das Formular nach Erfolg leer sein, selbst zurücksetzen (z.B. per key oder form.reset()).
 */
export function submitKeepingValues(formAction: (formData: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    let fd: FormData;
    try {
      fd = new FormData(e.currentTarget, submitter);
    } catch {
      fd = new FormData(e.currentTarget);
    }
    startTransition(() => formAction(fd));
  };
}

export function SubmitButton({ children, pendingText, disabled, pending: pendingProp, ...props }: React.ComponentProps<typeof Button> & { pendingText?: string; /** Ladezustand von aussen, z.B. bei submitKeepingValues() */ pending?: boolean }) {
  const status = useFormStatus();
  const pending = status.pending || !!pendingProp;
  return (
    // Eigenes `disabled` darf den Ladezustand nicht aufheben (sonst Doppel-Absenden).
    <Button type="submit" {...props} disabled={pending || disabled} aria-busy={pending || undefined}>
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Spinner /> {pendingText ?? "Bitte warten…"}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
