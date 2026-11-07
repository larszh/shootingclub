"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PackageCheck, Search, ShieldCheck, ShoppingBag } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Alert, Badge, Button, Card, EmptyState, Input, SectionTitle } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { confirmDialog } from "@/components/ui/dialog";
import { isNavigationError, toast } from "@/lib/ui-feedback";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { counterSaleAction, issueOrderAction } from "@/modules/ammo/actions";
import { groupByCaliber, ORDER_STATUS, type ShopProduct } from "@/modules/ammo/types";
import { useLocale, useT } from "@/components/locale";
import { adminOrderStatusT, roundsT } from "./labels";
import { QuantityStepper } from "./stepper";

export type CounterMember = { userId: string; name: string; email: string; avatarUrl: string | null; memberNumber: string | null };
export type CounterOrder = {
  id: string; userId: string; status: string; totalCents: number; currency: string; createdLabel: string; note: string | null;
  items: Array<{ id: string; productName: string; caliber: string; quantity: number; unitLabel: string; roundsPerUnit: number }>;
};

export function Counter({ members, orders, products, requireIdCheck, approvalRequired, maxRounds, currency }: {
  members: CounterMember[]; orders: CounterOrder[]; products: ShopProduct[]; requireIdCheck: boolean; approvalRequired: boolean; maxRounds: number | null; currency: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [idChecked, setIdChecked] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const formatRounds = (n: number) => roundsT(n, locale, t);

  const openByUser = useMemo(() => {
    const m = new Map<string, CounterOrder[]>();
    for (const o of orders) m.set(o.userId, [...(m.get(o.userId) ?? []), o]);
    return m;
  }, [orders]);

  const q = query.trim().toLowerCase();
  const hits = q
    ? members.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.memberNumber ?? "").toLowerCase().includes(q)).slice(0, 30)
    : members.filter((m) => openByUser.has(m.userId));
  const selected = selectedId ? members.find((m) => m.userId === selectedId) ?? null : null;
  const myOrders = selected ? openByUser.get(selected.userId) ?? [] : [];

  const chosen = products.filter((p) => (qty[p.id] ?? 0) > 0);
  const saleCents = chosen.reduce((a, p) => a + (qty[p.id] ?? 0) * p.priceCents, 0);
  const saleRounds = chosen.reduce((a, p) => a + (qty[p.id] ?? 0) * p.roundsPerUnit, 0);
  const overLimit = maxRounds !== null && saleRounds > maxRounds;
  const idOk = !requireIdCheck || idChecked;

  function choose(userId: string | null) {
    setSelectedId(userId);
    setIdChecked(false);
    setQty({});
    setError(null);
  }

  function run(fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) {
          setError(r.error);
          toast.error(r.error);
          return;
        }
        toast.success(r.message ?? t("adm1.common.done"));
        after?.();
        router.refresh();
      } catch (e) {
        if (isNavigationError(e)) throw e;
        setError(t("adm1.common.failed"));
      }
    });
  }

  async function sell() {
    if (!selected || chosen.length === 0 || !idOk || overLimit) return;
    const okay = await confirmDialog({ title: t("adm1.ammo.counter.sellTitle", { name: selected.name }), message: t("adm1.ammo.counter.sellMessage", { rounds: formatRounds(saleRounds), total: formatMoney(saleCents, currency) }), confirmLabel: t("adm1.ammo.counter.sellConfirm") });
    if (!okay) return;
    run(() => counterSaleAction({ userId: selected.userId, lines: chosen.map((p) => ({ productId: p.id, quantity: qty[p.id] ?? 0 })), idChecked: idOk }), () => setQty({}));
  }

  if (!selected) {
    return (
      <div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("adm1.ammo.counter.searchPlaceholder")} aria-label={t("adm1.ammo.counter.search")} className="h-14 pl-12 text-lg" autoFocus />
        </div>
        <SectionTitle>{q ? t("adm1.ammo.counter.hits") : t("adm1.ammo.counter.withOpen")}</SectionTitle>
        {hits.length ? (
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {hits.map((m) => {
              const n = openByUser.get(m.userId)?.length ?? 0;
              return (
                <button key={m.userId} type="button" onClick={() => choose(m.userId)} className="press flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                  <Avatar name={m.name} src={m.avatarUrl} size={44} tone="soft" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-medium">{m.name}</span>
                    <span className="block truncate text-xs text-ink-3">{m.memberNumber ? `${t("adm1.ammo.counter.no", { n: m.memberNumber })} · ` : ""}{m.email}</span>
                  </span>
                  {n ? <Badge tone="accent">{t("adm1.ammo.counter.openCount", { n })}</Badge> : null}
                </button>
              );
            })}
          </Card>
        ) : (
          <EmptyState icon={<Search className="h-5 w-5" />} title={q ? t("adm1.ammo.counter.nobody") : t("adm1.ammo.counter.noOpen")} text={q ? t("adm1.ammo.counter.nobodyText") : t("adm1.ammo.counter.noOpenText")} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Avatar name={selected.name} src={selected.avatarUrl} size={52} tone="soft" />
        <div className="min-w-0 flex-1 basis-40">
          <div className="text-lg font-semibold">{selected.name}</div>
          <div className="truncate text-xs text-ink-3">{selected.memberNumber ? `${t("adm1.ammo.counter.no", { n: selected.memberNumber })} · ` : ""}{selected.email}</div>
        </div>
        <Button type="button" variant="secondary" onClick={() => choose(null)}><ArrowLeft className="h-4 w-4" /> {t("adm1.ammo.counter.otherMember")}</Button>
      </Card>

      {requireIdCheck ? (
        <label className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-card border-2 px-4 py-3", idChecked ? "border-ok bg-ok/10" : "border-warn/50 bg-warn/10")}>
          <input type="checkbox" checked={idChecked} onChange={(e) => setIdChecked(e.target.checked)} className="h-7 w-7 shrink-0 accent-[var(--ink)]" />
          <span>
            <span className="flex items-center gap-2 text-[17px] font-semibold"><ShieldCheck className="h-5 w-5" aria-hidden /> {t("adm1.ammo.idChecked")}</span>
            <span className="block text-sm text-ink-2">{t("adm1.ammo.counter.idCheckedText")}</span>
          </span>
        </label>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}

      <SectionTitle>{t("adm1.ammo.counter.openOrders")}</SectionTitle>
      {myOrders.length ? (
        <div className="stagger grid gap-3 md:grid-cols-2">
          {myOrders.map((o) => {
            const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.ORDERED!;
            const rounds = o.items.reduce((a, i) => a + i.quantity * i.roundsPerUnit, 0);
            return (
              <Card key={o.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-ink-3">{t("adm1.ammo.counter.orderedAt", { date: o.createdLabel })}</div>
                  <Badge tone={st.tone}>{o.status === "ORDERED" && approvalRequired ? t("adm1.ammo.counter.notApproved") : adminOrderStatusT(o.status, t)}</Badge>
                </div>
                <ul className="space-y-1">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3 text-[15px]">
                      <span><span className="font-semibold tabular-nums">{i.quantity} ×</span> {i.unitLabel} {i.productName}<span className="block text-xs text-ink-3">{i.caliber}</span></span>
                    </li>
                  ))}
                </ul>
                {o.note ? <p className="rounded-control bg-surface-2 px-3 py-2 text-sm">«{o.note}»</p> : null}
                <div className="flex justify-between text-sm"><span className="text-ink-3">{formatRounds(rounds)}</span><span className="font-semibold tabular-nums">{formatMoney(o.totalCents, o.currency)}</span></div>
                <Button type="button" size="lg" className="w-full" disabled={pending || !idOk} onClick={() => run(() => issueOrderAction(o.id, idOk))}>
                  <PackageCheck className="h-5 w-5" /> {t("adm1.ammo.counter.issue")}
                </Button>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-ink-3">{t("adm1.ammo.counter.noOpenSellBelow")}</p>
      )}

      <SectionTitle>{t("adm1.ammo.counter.directSale")}</SectionTitle>
      {products.length ? (
        <>
          {groupByCaliber(products).map((g) => (
            <Card key={g.caliber} className="divide-y divide-line overflow-hidden">
              <div className="bg-surface-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink-3">{g.caliber}</div>
              {g.items.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-ink-3">{t("money.ammo.perUnit", { price: formatMoney(p.priceCents, currency), unit: p.unitLabel })} · {formatRounds(p.roundsPerUnit)}{p.available !== null ? ` · ${t("adm1.ammo.counter.available", { n: p.available })}` : ""}</div>
                  </div>
                  <QuantityStepper label={p.name} value={qty[p.id] ?? 0} max={p.available} onChange={(v) => setQty((s) => ({ ...s, [p.id]: v }))} />
                </div>
              ))}
            </Card>
          ))}
          <div className="sticky bottom-24 z-10 md:bottom-4">
            <Card className="space-y-2 p-4 shadow-lg">
              <div className="flex items-end justify-between">
                <div className="text-2xl font-semibold tabular-nums">{formatMoney(saleCents, currency)}</div>
                <div className={cn("text-sm tabular-nums", overLimit ? "text-danger" : "text-ink-3")}>{formatRounds(saleRounds)}{maxRounds !== null ? ` / ${t("adm1.ammo.counter.max", { n: maxRounds })}` : ""}</div>
              </div>
              {!idOk && chosen.length ? <p className="text-xs text-warn">{t("adm1.ammo.counter.confirmIdFirst")}</p> : null}
              <Button type="button" size="lg" className="w-full" disabled={pending || chosen.length === 0 || !idOk || overLimit} onClick={sell} aria-busy={pending || undefined}>
                {pending ? <span className="inline-flex items-center gap-2"><Spinner /> {t("adm1.common.pleaseWait")}</span> : <><ShoppingBag className="h-5 w-5" /> {t("adm1.ammo.counter.sellButton")}</>}
              </Button>
            </Card>
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-3">{t("adm1.ammo.counter.noProducts")}</p>
      )}
    </div>
  );
}
