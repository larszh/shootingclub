"use client";

import { useTransition } from "react";
import { superSetSuperAdminAction } from "@/modules/core/tenant-actions";
import { Badge } from "@/components/ui";
import { Avatar } from "@/components/avatar";

export function UserRow({ id, name, email, isSuperAdmin, isSelf, tenants, avatarUrl }: { id: string; name: string; email: string; isSuperAdmin: boolean; isSelf: boolean; tenants: string[]; avatarUrl?: string | null }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar name={name} src={avatarUrl} size={40} tone="soft" />
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate flex items-center gap-2">{name}{isSuperAdmin ? <Badge tone="accent">Super-Admin</Badge> : null}</div>
        <div className="text-xs text-ink-3 truncate">{email}{tenants.length ? ` · ${tenants.join(", ")}` : ""}</div>
      </div>
      <button type="button" disabled={pending || isSelf} onClick={() => start(() => superSetSuperAdminAction(id, !isSuperAdmin).then(() => undefined))} className="h-9 px-3 rounded-control border border-line text-sm disabled:opacity-40">{isSuperAdmin ? "Entziehen" : "Super-Admin"}</button>
    </div>
  );
}
