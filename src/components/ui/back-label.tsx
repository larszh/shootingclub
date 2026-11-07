"use client";

import { useT } from "@/components/locale";

/** Standard-Beschriftung «Zurück» in der Sprache der Seite (für <PageHeader> ohne eigenes Label). */
export function BackLabel() {
  const t = useT();
  return <>{t("shell.common.back")}</>;
}
