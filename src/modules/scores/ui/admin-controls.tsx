"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useTransition } from "react";
import { Archive, Eye, EyeOff } from "lucide-react";
import { archiveProgramAction, setProgramHiddenAction } from "@/modules/scores/actions";
import { Button } from "@/components/ui";
import { useT } from "@/components/locale";

export function ProgramHiddenToggle({ programId, hidden }: { programId: string; hidden: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => start(() => setProgramHiddenAction(programId, !hidden).then(() => undefined))}>
      {hidden ? <><Eye className="h-4 w-4" /> {t("shooting.program.admin.show")}</> : <><EyeOff className="h-4 w-4" /> {t("shooting.program.admin.hide")}</>}
    </Button>
  );
}

export function ProgramArchiveButton({ programId, archived }: { programId: string; archived: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending}
      onClick={async () => { if (archived || (await confirmDialog({ title: t("shooting.program.admin.archiveConfirm") }))) start(() => archiveProgramAction(programId, !archived).then(() => undefined)); }}>
      <Archive className="h-4 w-4" /> {archived ? t("shooting.program.admin.restore") : t("shooting.program.admin.archive")}
    </Button>
  );
}
