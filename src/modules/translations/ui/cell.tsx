"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import type { Locale } from "@/lib/i18n/core";
import { Badge, Button, Textarea } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { cn } from "@/lib/utils";
import { saveTranslationAction } from "../actions";
import { referenceText } from "../context";
import { checkPlaceholders, MAX_VALUE_LENGTH, normalizeValue, placeholdersOf, type Cell } from "../logic";
import type { translationsT } from "../texts";

type T = ReturnType<typeof translationsT>;

export function StateBadge({ cell, locale, t }: { cell: Cell; locale: Locale; t: T }) {
  if (cell.state === "custom") return <Badge tone="accent">{t("state.custom")}</Badge>;
  if (cell.state === "missing") return <Badge tone="warn">{t("state.missing")}</Badge>;
  if (locale !== "de" && cell.needsWork) return <Badge tone="warn">{t("state.sameAsDe")}</Badge>;
  return <Badge>{t("state.default")}</Badge>;
}

export function CellView({
  rowKey, locale, cell, german, editing, onEdit, onSaved, t,
}: {
  rowKey: string;
  locale: Locale;
  cell: Cell;
  german: string;
  editing: boolean;
  onEdit: (on: boolean) => void;
  onSaved: () => void;
  t: T;
}) {
  if (editing) return <CellEditor rowKey={rowKey} locale={locale} cell={cell} german={german} onClose={() => onEdit(false)} onSaved={onSaved} t={t} />;
  return (
    <button
      type="button" onClick={() => onEdit(true)}
      className="group flex min-h-11 w-full min-w-0 flex-col items-start gap-1 px-3 py-2.5 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
      aria-label={t("cell.edit", { locale: locale.toUpperCase(), key: rowKey })}
    >
      <span className="flex w-full items-center gap-2">
        <span className="text-xs font-semibold text-ink-3">{locale.toUpperCase()}</span>
        <StateBadge cell={cell} locale={locale} t={t} />
        <Pencil className="ml-auto h-3.5 w-3.5 text-ink-3 opacity-0 group-hover:opacity-100" aria-hidden />
      </span>
      <span className={cn("line-clamp-4 w-full text-sm break-words whitespace-pre-line", !cell.value && "italic text-ink-3")}>
        {cell.value || t("cell.fallsBack")}
      </span>
    </button>
  );
}

function CellEditor({ rowKey, locale, cell, german, onClose, onSaved, t }: { rowKey: string; locale: Locale; cell: Cell; german: string; onClose: () => void; onSaved: () => void; t: T }) {
  const [value, setValue] = useState(cell.value);
  const [pending, start] = useTransition();
  const reference = referenceText(locale, rowKey);
  const normalized = normalizeValue(value);
  const check = normalized ? checkPlaceholders(reference, normalized) : ({ ok: true } as const);
  const tooLong = normalized.length > MAX_VALUE_LENGTH;
  const wanted = placeholdersOf(reference ?? "");

  function save(v: string) {
    start(async () => {
      const res = await saveTranslationAction({ locale, key: rowKey, value: v });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data?.op !== "none") toast.success(res.message ?? "");
      onClose();
      onSaved();
    });
  }

  return (
    <form
      className="space-y-2 bg-surface-2/60 px-3 py-3 sm:col-span-2 lg:col-span-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (check.ok && !tooLong) save(value);
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-ink-3">{locale.toUpperCase()}</span>
        <StateBadge cell={cell} locale={locale} t={t} />
      </div>
      {locale !== "de" && german ? (
        <p className="rounded-control bg-surface px-3 py-2 text-sm text-ink-2 whitespace-pre-line">
          <span className="mr-1 text-xs font-semibold text-ink-3">DE</span>
          {german}
        </p>
      ) : null}
      <Textarea
        value={value} onChange={(e) => setValue(e.target.value)} rows={Math.min(10, Math.max(3, Math.ceil(value.length / 60)))}
        aria-label={t("cell.textLabel", { locale: locale.toUpperCase() })} aria-invalid={!check.ok || tooLong} autoFocus
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (check.ok && !tooLong) save(value);
          }
        }}
      />
      {wanted.length ? <p className="text-xs text-ink-3">{t("cell.placeholders", { list: wanted.map((p) => `{${p}}`).join(" ") })}</p> : null}
      {!check.ok ? (
        <p className="text-sm text-danger" role="alert">
          {check.missing.length ? t("err.placeholdersMissing", { list: check.missing.map((p) => `{${p}}`).join(", ") }) : null}{" "}
          {check.extra.length ? t("err.placeholdersExtra", { list: check.extra.map((p) => `{${p}}`).join(", ") }) : null}
        </p>
      ) : null}
      {tooLong ? <p className="text-sm text-danger" role="alert">{t("err.tooLong")}</p> : null}
      {cell.base !== undefined && cell.state === "custom" ? (
        <p className="text-xs text-ink-3 whitespace-pre-line">{t("cell.builtIn")}: {cell.base}</p>
      ) : null}
      <p className="text-xs text-ink-3">{t("cell.emptyHint")}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !check.ok || tooLong}>{pending ? <Spinner /> : null} {t("cell.save")}</Button>
        {cell.state === "custom" ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => save("")}>{t("cell.reset")}</Button>
        ) : null}
        <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>{t("cell.cancel")}</Button>
      </div>
    </form>
  );
}
