"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { superSetSuperAdmin } from "@/modules/core/super-actions";
import { Badge } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { confirmDialog } from "@/components/ui/dialog";
import { toast } from "@/lib/ui-feedback";
import { useT } from "@/components/locale";

export function UserRow({ id, name, email, isSuperAdmin, isSelf, deleted, twoFactor, tenants, avatarUrl }: { id: string; name: string; email: string; isSuperAdmin: boolean; isSelf: boolean; deleted: boolean; twoFactor: boolean; tenants: string[]; avatarUrl?: string | null }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();

  async function toggle() {
    const next = !isSuperAdmin;
    const confirmed = await confirmDialog(
      next
        ? { title: t("adm2.super.u.grantQ", { name }), message: t("adm2.super.u.grantText"), confirmLabel: t("adm2.super.u.grant") }
        : { title: t("adm2.super.u.revokeQ", { name }), tone: "danger", confirmLabel: t("adm2.super.u.revoke") },
    );
    if (!confirmed) return;
    start(async () => {
      const res = await superSetSuperAdmin(id, next);
      if (res.ok) {
        toast.success(res.message ?? t("adm2.common.saved"));
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar name={name} src={avatarUrl} size={40} tone="soft" />
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate flex items-center gap-2">
          {name}
          {isSuperAdmin ? <Badge tone="accent">{t("adm2.super.u.superAdmin")}</Badge> : null}
          {deleted ? <Badge tone="danger">{t("adm2.super.u.deleted")}</Badge> : null}
          {twoFactor ? <Badge tone="ok">2FA</Badge> : null}
        </div>
        <div className="text-xs text-ink-3 truncate">{email}{tenants.length ? ` · ${tenants.join(", ")}` : ""}</div>
      </div>
      {deleted ? null : (
        <button type="button" disabled={pending || isSelf} onClick={toggle} className="h-11 shrink-0 px-3 rounded-control border border-line text-sm disabled:opacity-40">
          {isSuperAdmin ? t("adm2.super.u.revoke") : t("adm2.super.u.superAdmin")}
        </button>
      )}
    </div>
  );
}
