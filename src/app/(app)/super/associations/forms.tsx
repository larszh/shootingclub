"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createAssociationAction } from "@/modules/association/actions";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { useT } from "@/components/locale";

export function CreateAssociationForm() {
  const [state, action] = useActionState(createAssociationAction, null);
  const router = useRouter();
  const t = useT();
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
        <Field label={t("adm2.common.name")} error={err?.name}><Input name="name" required maxLength={191} placeholder={t("adm2.super.as.namePh")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("adm2.super.as.region")} error={err?.region}><Input name="region" maxLength={191} placeholder="ZH" /></Field>
          <Field label={t("adm2.super.as.codeOpt")} hint={t("adm2.super.as.codeHint")} error={err?.code}><Input name="code" maxLength={8} className="font-mono uppercase" autoCapitalize="characters" /></Field>
        </div>
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <SubmitButton variant="secondary">{t("adm2.super.as.create")}</SubmitButton>
      </form>
    </Card>
  );
}
