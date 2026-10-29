"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, Download, Mail, Square, Users, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Badge, Button, Card, EmptyState, Select } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { confirmDialog, isNavigationError, toast } from "@/lib/ui-feedback";
import { ROLE_LABELS, type TenantRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/action-result";
import type { AccessState, MemberListRow } from "@/modules/members/queries";
import { MEMBER_STATUSES, STATUS_LABELS, statusLabel, statusTone } from "@/modules/members/types";
import { bulkSendAccessMailAction, bulkSetCategoryAction, bulkSetStatusAction, exportMembersCsvAction, selectAllMatchingAction } from "@/modules/members/actions";

const ACCESS: Record<AccessState, { label: string; tone: "ok" | "warn" | "outline" | "neutral" } | null> = {
  password: null,
  invited: { label: "Eingeladen", tone: "warn" },
  none: { label: "Kein Zugang", tone: "outline" },
  noemail: { label: "Ohne E-Mail", tone: "neutral" },
};

export function MemberList({ rows, total, query, canManage, categories }: {
  rows: MemberListRow[];
  total: number;
  query: string;
  canManage: boolean;
  categories: Array<{ id: string; name: string }>;
}) {
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
        toast.error("Das hat nicht geklappt. Bitte nochmals versuchen.");
      }
    });
  }

  const ids = [...selected];
  const clearSelection = () => setSelected(new Set());
  const selectAll = () => run(() => selectAllMatchingAction(query), (d) => d && setSelected(new Set(d.ids)));

  const exportCsv = () => run(() => exportMembersCsvAction(ids), (d) => {
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
    if (status === "LEFT" && !(await confirmDialog({ title: `${ids.length} als ausgetreten markieren?`, message: "Sie verlieren den Zugang zum Verein. Daten und Rechnungen bleiben erhalten.", tone: "danger", confirmLabel: "Ausgetreten" }))) return;
    // Danach Auswahl leeren: Geänderte fallen je nach Filter aus der Liste und dürfen nicht
    // unsichtbar ausgewählt bleiben.
    run(() => bulkSetStatusAction(ids, status), clearSelection);
  };
  const setCategory = (value: string) => {
    if (!value) return;
    run(() => bulkSetCategoryAction(ids, value === "none" ? null : value), clearSelection);
  };
  const sendMails = async () => {
    if (!(await confirmDialog({ title: "Zugangsmail senden?", message: `Ausgewählte Mitglieder ohne Passwort erhalten einen Link, mit dem sie ein Passwort festlegen (14 Tage gültig). Wer schon Zugang hat, wird übersprungen.`, confirmLabel: "Senden" }))) return;
    run(() => bulkSendAccessMailAction(ids));
  };

  if (!rows.length) {
    return <EmptyState icon={<Users className="h-5 w-5" />} title="Keine Mitglieder gefunden" text="Andere Suche versuchen oder Filter zurücksetzen." />;
  }

  return (
    <div className={cn(selected.size ? "pb-36 md:pb-20" : undefined)}>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3">
        <button type="button" onClick={togglePage} className="press -ml-2 inline-flex h-11 items-center gap-2 rounded-control px-2 font-medium text-ink-2 hover:bg-surface-2">
          {allOnPage ? <CheckSquare className="h-5 w-5 text-accent" /> : <Square className="h-5 w-5" />}
          {allOnPage ? "Seite abwählen" : "Seite auswählen"}
        </button>
        <span className="tabular-nums">{total} {total === 1 ? "Treffer" : "Treffer"}</span>
        {selected.size && selected.size < total ? (
          <button type="button" onClick={selectAll} disabled={pending} className="inline-flex h-11 items-center font-medium text-accent hover:underline">Alle {total} auswählen</button>
        ) : null}
      </div>

      {/* Mobil: Karten */}
      <Card className="divide-y divide-line overflow-hidden md:hidden">
        {rows.map((m) => (
          <div key={m.id} className={cn("flex items-center gap-1 pr-3", selected.has(m.id) && "bg-accent-soft/40")}>
            <SelectBox checked={selected.has(m.id)} onChange={() => toggle(m.id)} label={m.name} />
            <Link href={`/admin/members/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3">
              <Avatar name={m.name} src={m.avatarUrl} size={40} tone="soft" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.name}</div>
                <div className="truncate text-xs text-ink-3">
                  {[m.memberNumber ? `Nr. ${m.memberNumber}` : null, m.category, m.household].filter(Boolean).join(" · ") || m.email || "–"}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone={statusTone(m.status)}>{statusLabel(m.status)}</Badge>
                  {m.role !== "MEMBER" ? <Badge tone="accent">{ROLE_LABELS[m.role as TenantRole] ?? m.role}</Badge> : null}
                  {m.minor ? <Badge tone="warn">U18</Badge> : null}
                  {ACCESS[m.access] ? <Badge tone={ACCESS[m.access]!.tone}>{ACCESS[m.access]!.label}</Badge> : null}
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
              <th className="w-12 px-2 py-2"><span className="sr-only">Auswahl</span></th>
              <th className="px-2 py-2 font-semibold">Name</th>
              <th className="px-2 py-2 font-semibold">Nr.</th>
              <th className="px-2 py-2 font-semibold">Status</th>
              <th className="px-2 py-2 font-semibold">Kategorie</th>
              <th className="px-2 py-2 font-semibold">Haushalt</th>
              <th className="px-2 py-2 font-semibold">Zugang</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((m) => (
              <tr key={m.id} className={cn("hover:bg-surface-2/60", selected.has(m.id) && "bg-accent-soft/40")}>
                <td className="px-1"><SelectBox checked={selected.has(m.id)} onChange={() => toggle(m.id)} label={m.name} /></td>
                <td className="max-w-72 px-2 py-2">
                  <Link href={`/admin/members/${m.id}`} className="flex min-h-11 items-center gap-3">
                    <Avatar name={m.name} src={m.avatarUrl} size={32} tone="soft" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium hover:underline">
                        {m.name}
                        {m.role !== "MEMBER" ? <span className="ml-1.5 text-xs font-normal text-accent">{ROLE_LABELS[m.role as TenantRole] ?? m.role}</span> : null}
                      </span>
                      <span className="block truncate text-xs text-ink-3">{m.email ?? m.phone ?? "–"}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-2 py-2 tabular-nums text-ink-2">{m.memberNumber ?? "–"}</td>
                <td className="px-2 py-2">
                  <span className="flex flex-wrap gap-1"><Badge tone={statusTone(m.status)}>{statusLabel(m.status)}</Badge>{m.minor ? <Badge tone="warn">U18</Badge> : null}</span>
                </td>
                <td className="max-w-40 truncate px-2 py-2 text-ink-2">{m.category ?? "–"}</td>
                <td className="max-w-40 truncate px-2 py-2 text-ink-2">{m.household ?? "–"}</td>
                <td className="px-2 py-2">{ACCESS[m.access] ? <Badge tone={ACCESS[m.access]!.tone}>{ACCESS[m.access]!.label}</Badge> : <span className="text-ok">✓</span>}</td>
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
                {selected.size} ausgewählt
              </span>
              <button type="button" onClick={() => setSelected(new Set())} className="press inline-flex h-11 items-center gap-1 rounded-control px-2 text-sm text-ink-3 hover:bg-surface-2"><X className="h-4 w-4" /> Aufheben</button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {canManage ? (
                <>
                  <Select aria-label="Status ändern" value="" disabled={pending} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">Status ändern…</option>
                    {MEMBER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </Select>
                  <Select aria-label="Kategorie ändern" value="" disabled={pending} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">Kategorie…</option>
                    <option value="none">Keine Kategorie</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                  <Button variant="secondary" disabled={pending} onClick={sendMails}><Mail className="h-4 w-4" /> Zugangsmail</Button>
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
      <input type="checkbox" checked={checked} onChange={onChange} className="h-5 w-5 accent-[var(--accent)]" aria-label={`${label} auswählen`} />
    </label>
  );
}
