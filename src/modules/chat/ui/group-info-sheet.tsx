"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, UserMinus } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Badge, Button, Field, Input } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { Dialog, confirmDialog } from "@/components/ui/dialog";
import { toast } from "@/lib/ui-feedback";
import type { ActionResult } from "@/lib/action-result";
import {
  addGroupMembersAction,
  leaveConversationAction,
  removeGroupMemberAction,
  renameGroupAction,
  setClubSyncAction,
  setGroupAdminAction,
} from "../actions";
import type { ConversationDetail, PickerMember } from "../queries";
import { MAX_TITLE_LENGTH } from "../types";
import { MemberPicker } from "./member-picker";

/** Infos zur Unterhaltung: Mitglieder, Umbenennen, Hinzufügen/Entfernen, Stumm, Verlassen. */
export function GroupInfoSheet({
  open,
  onClose,
  detail,
  meId,
  tenantMembers,
  canManageClub,
  muted,
  onToggleMute,
}: {
  open: boolean;
  onClose: () => void;
  detail: ConversationDetail;
  meId: string;
  tenantMembers: PickerMember[];
  canManageClub: boolean;
  muted: boolean;
  onToggleMute: (v: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(detail.rawTitle ?? "");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const isGroup = detail.kind === "GROUP";
  const isAdmin = isGroup && detail.myRole === "ADMIN";

  const candidates = useMemo(() => {
    const inGroup = new Set(detail.members.map((m) => m.userId));
    return tenantMembers.filter((m) => !inGroup.has(m.id));
  }, [detail.members, tenantMembers]);

  function run<T>(fn: () => Promise<ActionResult<T>>, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        if (res.message) toast.success(res.message);
        after?.();
        router.refresh();
      } else toast.error(res.error);
    });
  }

  async function leave() {
    const ok = await confirmDialog(
      isGroup
        ? { title: "Gruppe verlassen?", message: "Du erhältst keine Nachrichten mehr aus dieser Gruppe. Ein Admin kann dich wieder hinzufügen.", tone: "danger", confirmLabel: "Verlassen" }
        : { title: "Unterhaltung entfernen?", message: "Sie verschwindet aus deiner Liste und erscheint wieder, wenn eine neue Nachricht kommt.", tone: "danger", confirmLabel: "Entfernen" },
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await leaveConversationAction(detail.id);
      if (res.ok) {
        toast.success(res.message ?? "Erledigt.");
        onClose();
        router.replace("/chat");
      } else toast.error(res.error);
    });
  }

  async function remove(userId: string, name: string) {
    const ok = await confirmDialog({ title: `${name} entfernen?`, message: "Die Person sieht die Gruppe danach nicht mehr.", tone: "danger", confirmLabel: "Entfernen" });
    if (ok) run(() => removeGroupMemberAction(detail.id, userId));
  }

  return (
    <Dialog open={open} onClose={onClose} title={isGroup ? "Gruppeninfo" : "Unterhaltung"} variant="auto" size="lg">
      <div className="space-y-5 pb-2">
        {isAdmin ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renameGroupAction(detail.id, title));
            }}
          >
            <Field label="Name der Gruppe" className="min-w-0 flex-1">
              <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MAX_TITLE_LENGTH} required />
            </Field>
            <Button type="submit" variant="secondary" disabled={pending || !title.trim() || title.trim() === detail.rawTitle}>
              Speichern
            </Button>
          </form>
        ) : null}

        <Switch checked={muted} onChange={onToggleMute} label="Stummschalten" description="Keine Zählung im Badge für diese Unterhaltung." />

        {isGroup && canManageClub ? (
          <Switch
            checked={detail.isClub}
            disabled={pending}
            onChange={(v) => run(() => setClubSyncAction(detail.id, v))}
            label="Vereins-Gruppe aktuell halten"
            description="Alle Vereinsmitglieder sind automatisch in dieser Gruppe."
          />
        ) : null}

        {isGroup ? (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">{detail.members.length === 1 ? "1 Mitglied" : `${detail.members.length} Mitglieder`}</h3>
            <ul className="-mx-2">
              {detail.members.map((m) => {
                const self = m.userId === meId;
                return (
                  <li key={m.userId} className="flex min-h-14 items-center gap-3 rounded-control px-2 py-1.5">
                    <Avatar name={m.name} src={m.avatarUrl} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{self ? `${m.name} (du)` : m.name}</span>
                      {m.role === "ADMIN" ? <Badge tone="accent" className="mt-0.5">Admin</Badge> : null}
                    </span>
                    {isAdmin && !self ? (
                      <span className="flex shrink-0 items-center">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => setGroupAdminAction(detail.id, m.userId, m.role !== "ADMIN"))}
                          aria-label={m.role === "ADMIN" ? `${m.name} als Admin entfernen` : `${m.name} zum Admin machen`}
                          aria-pressed={m.role === "ADMIN"}
                          className="press flex h-11 w-11 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent aria-pressed:text-accent"
                        >
                          <ShieldCheck className="h-5 w-5" aria-hidden />
                        </button>
                        {!detail.isClub ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => remove(m.userId, m.name)}
                            aria-label={`${m.name} aus der Gruppe entfernen`}
                            className="press flex h-11 w-11 items-center justify-center rounded-full text-ink-3 hover:bg-danger/10 hover:text-danger focus-visible:outline-2 focus-visible:outline-accent"
                          >
                            <UserMinus className="h-5 w-5" aria-hidden />
                          </button>
                        ) : null}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <section className="flex items-center gap-3">
            <Avatar name={detail.title} src={detail.avatarUrl} size={48} />
            <div className="min-w-0">
              <p className="truncate font-medium">{detail.title}</p>
              {detail.otherLeft ? <p className="text-sm text-ink-3">Nicht mehr im Verein</p> : null}
            </div>
          </section>
        )}

        {isAdmin && !detail.isClub ? (
          adding ? (
            <section className="rounded-card border border-line p-3">
              <h3 className="mb-2 text-sm font-medium text-ink-2">Mitglieder hinzufügen</h3>
              <MemberPicker
                members={candidates}
                selected={selected}
                emptyText="Alle Vereinsmitglieder sind bereits in der Gruppe."
                maxHeightClass="max-h-[35dvh]"
                onToggle={(id) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
              />
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setAdding(false)} className="flex-1">
                  Abbrechen
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={pending || selected.size === 0}
                  onClick={() =>
                    run(
                      () => addGroupMembersAction(detail.id, [...selected]),
                      () => {
                        setSelected(new Set());
                        setAdding(false);
                      },
                    )
                  }
                >
                  Hinzufügen
                </Button>
              </div>
            </section>
          ) : (
            <Button type="button" variant="secondary" className="w-full" onClick={() => setAdding(true)}>
              Mitglieder hinzufügen
            </Button>
          )
        ) : null}

        {!detail.isClub ? (
          <Button type="button" variant="ghost" className="w-full text-danger hover:bg-danger/10" onClick={leave} disabled={pending}>
            <LogOut className="h-5 w-5" aria-hidden /> {isGroup ? "Gruppe verlassen" : "Unterhaltung entfernen"}
          </Button>
        ) : (
          <p className="text-center text-sm text-ink-3">Die Vereins-Gruppe kann nicht verlassen werden. Du kannst sie stummschalten.</p>
        )}
      </div>
    </Dialog>
  );
}
