"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, Download, Mail, Square, Users, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Badge, Button, Card, EmptyState, Select } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { confirmDialog, isNavigationError, toast } from "@/lib/ui-feedback";
import { getT, type Locale, type TFunction } from "@/lib/i18n/core";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/action-result";
import type { AccessState, MemberListRow } from "@/modules/members/queries";
import { MEMBER_STATUSES, isMemberStatus, statusTone } from "@/modules/members/types";
import { bulkSendAccessMailAction, bulkSetCategoryAction, bulkSetStatusAction, exportMembersCsvAction, selectAllMatchingAction } from "@/modules/members/actions";

const ACCESS: Record<AccessState, { label: string; tone: "ok" | "warn" | "outline" | "neutral" } | null> = {
  password: null,
  invited: { label: "adm1.members.accessBadge.invited", tone: "warn" },
  none: { label: "adm1.members.accessBadge.none", tone: "outline" },
  noemail: { label: "adm1.members.accessBadge.noemail", tone: "neutral" },
};

/** Status und Rolle in der Anzeigesprache; unbekannte Werte bleiben unverändert. */
function statusText(t: TFunction, s: string) {
  return isMemberStatus(s) ? t(`members.status.${s}`) : s || "–";
}
function roleText(t: TFunction, r: string) {
  return ["OWNER", "ADMIN", "TRAINER", "MEMBER"].includes(r) ? t(`role.${r}`) : r;
}

export function MemberList({ locale, rows, total, query, canManage, categories }: {
  locale: Locale;
  rows: MemberListRow[];
  total: number;
  query: string;
  canManage: boolean;
  categories: Array<{ id: string; name: string }>;
}) {
  const t = getT(locale);
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pending, start] = useTransition();
  const pageIds = rows.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const togglePage = () => setSelected((s) => {
    const n = new Set(s);
    if (allOnPage) pageIds.forEach((id) => n.delete(id));
    else pageIds.forEach((id) => n.add(id));
    return n;
  });

  function run<T>(fn: () => Promise<ActionResult<T>>, after?: (data: T | undefined) => void) {
    start(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        if (res.message) toast.success(res.message);
        after?.(res.data);
        router.refresh();
      } catch (e) {
        if (isNavigationError(e)) throw e;
        toast.error(t("adm1.common.failed"));
      }
    });
  }

  const ids = [...selected];
  const clearSelection = () => setSelected(new Set());
  const selectAll = () => run(() => selectAllMatchingAction(query), (d) => d && setSelected(new Set(d.ids)));

  const exportCsv = () => run(() => exportMembersCsvAction(ids, query), (d) => {
    if (!d) return;
    const url = URL.createObjectURL(new Blob([d.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = d.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const setStatus = async (status: string) => {
    if (!status) return;
    if (status === "LEFT" && !(await confirmDialog({ title: t("adm1.members.bulkLeftTitle", { n: ids.length }), message: t("adm1.members.bulkLeftMessage"), tone: "danger", confirmLabel: t("members.status.LEFT") }))) return;
    // Danach Auswahl leeren: Geänderte fallen je nach Filter aus der Liste und dürfen nicht
    // unsichtbar ausgewählt bleiben.
    run(() => bulkSetStatusAction(ids, status), clearSelection);
  };
  const setCategory = (value: string) => {
    if (!value) return;
    run(() => bulkSetCategoryAction(ids, value === "none" ? null : value), clearSelection);
  };
  const sendMails = async () => {
    if (!(await confirmDialog({ title: t("adm1.members.accessMailTitle"), message: t("adm1.members.accessMailMessage"), confirmLabel: t("adm1.members.send") }))) return;
    run(() => bulkSendAccessMailAction(ids));
  };

  if (!rows.length) {
    return <EmptyState icon={<Users className="h-5 w-5" />} title={t("adm1.members.emptyTitle")} text={t("adm1.members.emptyText")} />;
  }

  return (
    <div className={cn(selected.size ? "pb-36 md:pb-20" : undefined)}>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3">
        <button type="button" onClick={togglePage} className="press -ml-2 inline-flex h-11 items-center gap-2 rounded-control px-2 font-medium text-ink-2 hover:bg-surface-2">
          {allOnPage ? <CheckSquare className="h-5 w-5 text-accent" /> : <Square className="h-5 w-5" />}
          {t(allOnPage ? "adm1.members.deselectPage" : "adm1.members.selectPage")}
        </button>
        <span className="tabular-nums">{t(total === 1 ? "adm1.members.hits.one" : "adm1.members.hits.other", { n: total })}</span>
        {selected.size && selected.size < total ? (
          <button type="button" onClick={selectAll} disabled={pending} className="inline-flex h-11 items-center font-medium text-accent hover:underline">{t("adm1.members.selectAll", { n: total })}</button>
        ) : null}
      </div>

      {/* Mobil: Karten */}
      <Card className="divide-y divide-line overflow-hidden md:hidden">
        {rows.map((m) => (
          <div key={m.id} className={cn("flex items-center gap-1 pr-3", selected.has(m.id) && "bg-accent-soft/40")}>
            <SelectBox checked={selected.has(m.id)} onChange={() => toggle(m.id)} label={t("adm1.members.selectOne", { name: m.name })} />
            <Link href={`/admin/members/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3">
              <Avatar name={m.name} src={m.avatarUrl} size={40} tone="soft" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.name}</div>
                <div className="truncate text-xs text-ink-3">
                  {[m.memberNumber ? t("adm1.members.numberShort", { nr: m.memberNumber }) : null, m.category, m.household].filter(Boolean).join(" · ") || m.email || "–"}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone={statusTone(m.status)}>{statusText(t, m.status)}</Badge>
                  {m.role !== "MEMBER" ? <Badge tone="accent">{roleText(t, m.role)}</Badge> : null}
                  {m.minor ? <Badge tone="warn">U18</Badge> : null}
                  {ACCESS[m.access] ? <Badge tone={ACCESS[m.access]!.tone}>{t(ACCESS[m.access]!.label)}</Badge> : null}
                </div>
              </div>
            </Link>
          </div>
        ))}
      </Card>

      {/* Desktop: Tabelle */}
      <Card className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-3">
            <tr>
              <th className="w-12 px-2 py-2"><span className="sr-only">{t("adm1.members.col.select")}</span></th>
              <th className="px-2 py-2 font-semibold">{t("adm1.common.name")}</th>
              <th className="px-2 py-2 font-semibold">{t("adm1.members.col.nr")}</th>
              <th className="px-2 py-2 font-semibold">{t("adm1.common.status")}</th>
              <th className="px-2 py-2 font-semibold">{t("adm1.members.col.category")}</th>
              <th className="px-2 py-2 font-semibold">{t("adm1.members.household")}</th>
              <th className="px-2 py-2 font-semibold">{t("adm1.members.col.access")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((m) => (
              <tr key={m.id} className={cn("hover:bg-surface-2/60", selected.has(m.id) && "bg-accent-soft/40")}>
                <td className="px-1"><SelectBox checked={selected.has(m.id)} onChange={() => toggle(m.id)} label={t("adm1.members.selectOne", { name: m.name })} /></td>
                <td className="max-w-72 px-2 py-2">
                  <Link href={`/admin/members/${m.id}`} className="flex min-h-11 items-center gap-3">
                    <Avatar name={m.name} src={m.avatarUrl} size={32} tone="soft" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium hover:underline">
                        {m.name}
                        {m.role !== "MEMBER" ? <span className="ml-1.5 text-xs font-normal text-accent">{roleText(t, m.role)}</span> : null}
                      </span>
                      <span className="block truncate text-xs text-ink-3">{m.email ?? m.phone ?? "–"}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-2 py-2 tabular-nums text-ink-2">{m.memberNumber ?? "–"}</td>
                <td className="px-2 py-2">
                  <span className="flex flex-wrap gap-1"><Badge tone={statusTone(m.status)}>{statusText(t, m.status)}</Badge>{m.minor ? <Badge tone="warn">U18</Badge> : null}</span>
                </td>
                <td className="max-w-40 truncate px-2 py-2 text-ink-2">{m.category ?? "–"}</td>
                <td className="max-w-40 truncate px-2 py-2 text-ink-2">{m.household ?? "–"}</td>
                <td className="px-2 py-2">{ACCESS[m.access] ? <Badge tone={ACCESS[m.access]!.tone}>{t(ACCESS[m.access]!.label)}</Badge> : <span className="text-ok">✓</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {selected.size ? (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-3 md:bottom-4 md:left-64 md:px-8">
          <div className="animate-rise mx-auto max-w-3xl rounded-card border border-line bg-surface p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold">
                {pending ? <Spinner /> : null}
                {t("adm1.members.selected", { n: selected.size })}
              </span>
              <button type="button" onClick={() => setSelected(new Set())} className="press inline-flex h-11 items-center gap-1 rounded-control px-2 text-sm text-ink-3 hover:bg-surface-2"><X className="h-4 w-4" /> {t("adm1.members.clearSelection")}</button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {canManage ? (
                <>
                  <Select aria-label={t("adm1.members.changeStatus")} value="" disabled={pending} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">{t("adm1.members.changeStatus")}…</option>
                    {MEMBER_STATUSES.map((s) => <option key={s} value={s}>{t(`members.status.${s}`)}</option>)}
                  </Select>
                  <Select aria-label={t("adm1.members.changeCategory")} value="" disabled={pending} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">{t("adm1.members.col.category")}…</option>
                    <option value="none">{t("adm1.members.noCategory")}</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                  <Button variant="secondary" disabled={pending} onClick={sendMails}><Mail className="h-4 w-4" /> {t("adm1.members.accessMail")}</Button>
                </>
              ) : null}
              <Button variant="secondary" disabled={pending} onClick={exportCsv} className={canManage ? undefined : "col-span-2 sm:col-span-4"}><Download className="h-4 w-4" /> CSV</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SelectBox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-5 w-5 accent-[var(--accent)]" aria-label={label} />
    </label>
  );
}
