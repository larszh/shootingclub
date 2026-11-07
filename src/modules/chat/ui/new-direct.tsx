"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card } from "@/components/ui";
import { toast } from "@/lib/ui-feedback";
import type { Locale } from "@/lib/i18n/core";
import { startDirectChatAction } from "../actions";
import type { PickerMember } from "../queries";
import { MemberPicker } from "./member-picker";

/** «Neue Nachricht»: Mitglied wählen, bestehende 1:1-Unterhaltung öffnen oder neu anlegen. */
export function NewDirectPicker({ members, locale = "de" }: { members: PickerMember[]; locale?: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await startDirectChatAction(id);
      if (res.ok && res.data) router.push(`/chat/${res.data.id}`);
      else if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <Card className="p-4">
      {error ? <Alert className="mb-3">{error}</Alert> : null}
      <MemberPicker members={members} onPick={pick} disabled={pending} locale={locale} />
    </Card>
  );
}
