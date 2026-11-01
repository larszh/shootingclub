"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card, Field, Input } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { getT, type Locale } from "@/lib/i18n/core";
import { createGroupAction } from "../actions";
import type { PickerMember } from "../queries";
import { MAX_TITLE_LENGTH } from "../types";
import { MemberPicker } from "./member-picker";

/** «Neue Gruppe»: Name und Mitglieder; Vereins-Admins können eine Vereins-Gruppe mit allen erstellen. */
export function NewGroupForm({ members, canCreateClub, clubGroupExists, locale = "de" }: { members: PickerMember[]; canCreateClub: boolean; clubGroupExists: boolean; locale?: Locale }) {
  const t = getT(locale);
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createGroupAction, null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [club, setClub] = useState(false);
  const [sync, setSync] = useState(!clubGroupExists);

  useEffect(() => {
    if (state?.ok && state.data) {
      toast.success(state.message ?? getT(locale)("money.chat.groupCreated"));
      router.push(`/chat/${state.data.id}`);
    }
  }, [state, router, locale]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form onSubmit={submitKeepingValues(formAction)} className="space-y-4">
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <Card className="space-y-4 p-4">
        <Field label={t("money.chat.groupName")} error={fe?.title}>
          <Input name="title" required maxLength={MAX_TITLE_LENGTH} placeholder={club ? t("money.chat.groupNamePhClub") : t("money.chat.groupNamePh")} autoComplete="off" />
        </Field>
        {canCreateClub ? (
          <div className="space-y-3 border-t border-line pt-4">
            <Switch name="club" checked={club} onChange={setClub} label={t("money.chat.clubGroup")} description={t("money.chat.clubGroupHint")} />
            {club ? (
              <Switch
                name="sync"
                checked={sync && !clubGroupExists}
                onChange={setSync}
                disabled={clubGroupExists}
                label={t("money.chat.autoSync")}
                description={clubGroupExists ? t("money.chat.autoSyncExists") : t("money.chat.autoSyncHint")}
              />
            ) : null}
            {fe?.sync ? <p className="text-sm text-danger" role="alert">{fe.sync}</p> : null}
          </div>
        ) : null}
      </Card>
      {!club ? (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-2">{t("money.chat.chooseMembers")}</h2>
          {fe?.members ? <p className="mb-2 text-sm text-danger" role="alert">{fe.members}</p> : null}
          <MemberPicker members={members} selected={selected} onToggle={toggle} name="member" maxHeightClass="max-h-[45dvh]" locale={locale} />
        </Card>
      ) : null}
      <SubmitButton pending={pending} pendingText={t("money.chat.creating")} className="w-full" size="lg">
        {t("money.chat.createGroup")}
      </SubmitButton>
    </form>
  );
}
