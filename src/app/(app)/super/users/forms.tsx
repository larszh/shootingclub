"use client";

import { useTransition } from "react";
import { superSetSuperAdminAction } from "@/modules/core/tenant-actions";
import { Badge } from "@/components/ui";
import { initials } from "@/lib/utils";

export function UserRow({ id, name, email, isSuperAdmin, isSelf, tenants }: { id: string; name: string; email: string; isSuperAdmin: boolean; isSelf: boolean; tenants: string[] }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">{initials(name)}</span>
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate flex items-center gap-2">{name}{isSuperAdmin ? <Badge tone="accent">Super-Admin</Badge> : null}</div>
        <div className="text-xs text-ink-3 truncate">{email}{tenants.length ? ` · ${tenants.join(", ")}` : ""}</div>
      </div>
      <button type="button" disabled={pending || isSelf} onClick={() => start(() => superSetSuperAdminAction(id, !isSuperAdmin).then(() => undefined))} className="h-9 px-3 rounded-control border border-line text-sm disabled:opacity-40">{isSuperAdmin ? "Entziehen" : "Super-Admin"}</button>
    </div>
  );
}
