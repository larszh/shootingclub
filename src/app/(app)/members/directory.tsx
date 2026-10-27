"use client";

import { useMemo, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Badge, Card, EmptyState, Input } from "@/components/ui";
import { ROLE_LABELS, TENANT_ROLES, type TenantRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export type DirectoryMember = {
  id: string;
  userId: string;
  name: string;
  email: string | null; // nur für Admins
  role: string;
  avatarUrl: string | null;
  since: string; // bereits formatiert, z.B. «März 2024»
  isSelf: boolean;
};

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function MemberDirectory({ members }: { members: DirectoryMember[] }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of members) c.set(m.role, (c.get(m.role) ?? 0) + 1);
    return c;
  }, [members]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return members.filter((m) => (!role || m.role === role) && (!q || normalize(m.name).includes(q) || (m.email ? normalize(m.email).includes(q) : false)));
  }, [members, query, role]);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name suchen…" className="pl-10 pr-11" aria-label="Mitglieder durchsuchen" />
        {query ? (
          <button type="button" onClick={() => setQuery("")} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-ink-3 hover:text-ink" aria-label="Suche leeren"><X className="h-4 w-4" /></button>
        ) : null}
      </div>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Nach Rolle filtern">
        <Chip active={role === null} onClick={() => setRole(null)}>Alle · {members.length}</Chip>
        {TENANT_ROLES.filter((r) => counts.has(r)).map((r) => (
          <Chip key={r} active={role === r} onClick={() => setRole(role === r ? null : r)}>{ROLE_LABELS[r]} · {counts.get(r)}</Chip>
        ))}
      </div>

      <div className="mt-3">
        {filtered.length === 0 ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title="Niemand gefunden" text="Versuche es mit einem anderen Namen oder entferne den Filter." />
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {filtered.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.name} src={m.avatarUrl} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.name}{m.isSelf ? <span className="text-xs text-ink-3"> (du)</span> : null}</div>
                  <div className="truncate text-xs text-ink-3">
                    {m.email ? (
                      <a href={`mailto:${m.email}`} className="hover:underline">{m.email}</a>
                    ) : (
                      <>dabei seit {m.since}</>
                    )}
                  </div>
                </div>
                <Badge tone={m.role === "OWNER" || m.role === "ADMIN" ? "accent" : m.role === "TRAINER" ? "ok" : "neutral"}>{ROLE_LABELS[m.role as TenantRole] ?? m.role}</Badge>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick}
      className={cn("press h-10 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors", active ? "bg-accent text-accent-ink" : "border border-line bg-surface text-ink-2 hover:bg-surface-2")}>
      {children}
    </button>
  );
}
