"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestAssociationJoinAction, leaveAssociationAction, setAssociationShareNamesAction } from "@/modules/association/actions";
import { CONSENT_POINTS, NEVER_SHARED } from "@/modules/association/access";
import { Alert, Card, Field, Input } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { Switch } from "@/components/ui/controls";
import { SubmitButton } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";

export function ConsentText() {
  return (
    <div className="text-sm text-ink-2 space-y-2">
      <p className="font-medium text-ink">Was der Verband sieht:</p>
      <ul className="list-disc pl-5 space-y-1">
        {CONSENT_POINTS.map((p) => <li key={p}>{p}</li>)}
      </ul>
      <p>{NEVER_SHARED}</p>
      <p>Ihr könnt jederzeit austreten. Der Verband sieht dann sofort keine Daten mehr.</p>
    </div>
  );
}

export function JoinAssociationForm() {
  const [state, action] = useActionState(requestAssociationJoinAction, null);
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Anfrage gesendet.");
      // Die Seite übergibt einen neuen key, sobald sich die Verbindungen ändern: das Formular startet dann leer.
      router.refresh();
    }
  }, [state, router]);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <Card className="animate-rise p-4">
      <form action={action} className="space-y-4">
        <Field label="Code des Verbands" hint="Erhaltet ihr vom Verband" error={err?.code}>
          <Input name="code" required maxLength={12} autoComplete="off" autoCapitalize="characters" className="font-mono uppercase tracking-[0.2em]" />
        </Field>
        <ConsentText />
        <label className="flex items-start gap-3 min-h-11 cursor-pointer">
          <input type="checkbox" name="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" />
          <span className="text-sm">Wir stimmen zu, dass der Verband die oben genannten Kennzahlen unseres Vereins sieht.</span>
        </label>
        {err?.consent ? <p className="text-sm text-danger">{err.consent}</p> : null}
        <Switch name="shareNames" label="Namen in Verbandsranglisten zeigen" description="Name, Verein und bestes Resultat eurer Schützen in Ranglisten des Verbands. Ohne: nur Anzahl Resultate." />
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <SubmitButton disabled={!consent}>Beitritt beantragen</SubmitButton>
      </form>
    </Card>
  );
}

export function ShareNamesSwitch({ linkId, shareNames, disabled }: { linkId: string; shareNames: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [on, setOn] = useState(shareNames);
  function change(v: boolean) {
    setOn(v);
    start(async () => {
      const res = await setAssociationShareNamesAction(linkId, v);
      if (res.ok) {
        toast.success(res.message ?? "Gespeichert.");
        router.refresh();
      } else {
        setOn(!v);
        toast.error(res.error);
      }
    });
  }
  return (
    <Switch
      checked={on}
      onChange={change}
      disabled={disabled || pending}
      label="Namen in Verbandsranglisten zeigen"
      description="Name, Verein und bestes Resultat. Ohne: nur Anzahl Resultate."
    />
  );
}

export function LeaveButton({ linkId, name, pending }: { linkId: string; name: string; pending: boolean }) {
  return (
    <ActionButton
      variant={pending ? "secondary" : "danger"}
      action={() => leaveAssociationAction(linkId)}
      confirm={
        pending
          ? { title: "Anfrage zurückziehen?", confirmLabel: "Zurückziehen" }
          : { title: `Aus «${name}» austreten?`, message: "Der Verband sieht ab sofort keine Daten eures Vereins mehr. Ein erneuter Beitritt braucht wieder eine Freigabe.", tone: "danger", confirmLabel: "Austreten" }
      }
      refresh
    >
      {pending ? "Anfrage zurückziehen" : "Austreten"}
    </ActionButton>
  );
}
