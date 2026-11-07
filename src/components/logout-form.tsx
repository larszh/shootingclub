"use client";

import type { ReactNode } from "react";
import { logoutAction } from "@/modules/core/auth-actions";
import { HELP_CHAT_STORAGE_KEY, SUPPORT_CHAT_STORAGE_KEY } from "@/modules/ai/help/history";

/** Gespeicherte Hilfe-/Support-Gespräche dieses Browsers entfernen (beim Abmelden). */
function clearAiChatStorage() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith(HELP_CHAT_STORAGE_KEY) || k.startsWith(SUPPORT_CHAT_STORAGE_KEY))) keys.push(k);
    }
    for (const k of keys) sessionStorage.removeItem(k);
  } catch {
    // Speicher nicht verfügbar (privates Fenster, blockiert): nichts zu entfernen.
  }
}

/** Abmelde-Formular; leert vor dem Absenden die im Browser gespeicherten KI-Gespräche. */
export function LogoutForm({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <form action={logoutAction} onSubmit={clearAiChatStorage} className={className}>
      {children}
    </form>
  );
}
