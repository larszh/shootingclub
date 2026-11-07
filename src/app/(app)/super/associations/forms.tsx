"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createAssociationAction } from "@/modules/association/actions";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";

export function CreateAssociationForm() {
  const [state, action] = useActionState(createAssociationAction, null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && state.data?.id) {
      formRef.current?.reset();
      router.push(`/super/associations/${state.data.id}`);
    }
  }, [state, router]);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <Card className="animate-rise p-4">
      <form ref={formRef} action={action} className="space-y-3">
        <Field label="Name" error={err?.name}><Input name="name" required maxLength={191} placeholder="z.B. Kantonalschützenverband Zürich" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Region / Kanton" error={err?.region}><Input name="region" maxLength={191} placeholder="ZH" /></Field>
          <Field label="Code (optional)" hint="Leer = automatisch" error={err?.code}><Input name="code" maxLength={8} className="font-mono uppercase" autoCapitalize="characters" /></Field>
        </div>
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <SubmitButton variant="secondary">Verband anlegen</SubmitButton>
      </form>
    </Card>
  );
}
