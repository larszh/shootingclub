"use client";

import { useRouter } from "next/navigation";
import { ActionButton, type ActionButtonProps } from "@/components/ui/action-button";

/** ActionButton, der nach Erfolg auf eine andere Seite wechselt (z.B. nach dem Löschen). */
export function NavActionButton({ to, ...props }: Omit<ActionButtonProps, "onSuccess"> & { to: string }) {
  const router = useRouter();
  return <ActionButton {...props} onSuccess={() => router.push(to)} />;
}
