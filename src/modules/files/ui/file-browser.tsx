"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronRight, Download, ExternalLink, Eye, Folder, FolderInput, FolderLock, FolderPlus, Home, MoreVertical, Pencil, Search, Settings2, Trash2, Upload, X } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Select, buttonClasses } from "@/components/ui";
import { Segmented } from "@/components/ui/controls";
import { Dialog, confirmDialog } from "@/components/ui/dialog";
import { SubmitButton, submitKeepingValues, Spinner } from "@/components/ui/form";
import { Avatar } from "@/components/avatar";
import type { ActionResult } from "@/lib/action-result";
import { isNavigationError, isNetworkError, toast } from "@/lib/ui-feedback";
import { cn } from "@/lib/utils";
import { getT, type Locale, type TFunction } from "@/lib/i18n/core";
import { createFolderAction, deleteFileAction, deleteFolderAction, moveFileAction, renameFileAction, updateFolderAction } from "../actions";
import type { FileRow, FolderRow } from "../queries";
import { FOLDER_VISIBILITY, formatBytes, MB, previewKind } from "../types";
import { FileTypeIcon } from "./file-icon";

export type BrowserFile = FileRow & { canEdit: boolean };
type CurrentFolder = { id: string; name: string; minRole: string; effectiveMinRole: string; parentId: string | null; path: Array<{ id: string; name: string }> } | null;

type Props = {
  tenantId: string;
  current: CurrentFolder;
  subfolders: FolderRow[];
  files: BrowserFile[];
  moveTargets: Array<{ id: string; label: string }>;
  canUpload: boolean;
  canManage: boolean;
  maxFileMb: number;
  /** freier Platz im Kontingent, null = unbegrenzt */
  remainingBytes: number | null;
  q: string;
  locale?: Locale;
};

const fileUrl = (id: string, download = false) => `/api/documents/${id}${download ? "?download=1" : ""}`;
const folderHref = (id: string | null) => (id ? `/files?folder=${encodeURIComponent(id)}` : "/files");

/** Sichtbarkeit eines Ordners (Mindestrolle) als Text, wie visibilityLabel() in ../types. */
function visibilityText(role: string, t: TFunction) {
  const key = role === "OWNER" || role === "TRAINER" || role === "ADMIN" ? role : "MEMBER";
  return t(`shell.files.visibility.${key}`);
}

function useRun(t: TFunction) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<unknown>>, onOk?: (r: ActionResult<unknown>) => void) =>
    new Promise<boolean>((resolve) => {
      start(async () => {
        let r: ActionResult<unknown>;
        try {
          r = await fn();
        } catch (e) {
          if (isNavigationError(e)) throw e;
          toast.error(isNetworkError(e) ? t("shell.files.err.offline") : t("shell.files.err.failed"), { description: isNetworkError(e) ? t("shell.files.err.offlineText") : t("shell.files.err.retry") });
          resolve(false);
          return;
        }
        if (!r.ok) {
          toast.error(r.error);
          resolve(false);
          return;
        }
        if (r.message) toast.success(r.message);
        if (onOk) onOk(r);
        else router.refresh();
        resolve(true);
      });
    });
  return { pending, run, router };
}

/* ------------------------------------------------------------------ Upload */

type UploadItem = { key: number; name: string; size: number; progress: number; status: "queued" | "uploading" | "done" | "error"; error?: string };

function uploadWithProgress(fd: FormData, onProgress: (pct: number) => void, t: TFunction) {
  // XMLHttpRequest statt fetch: nur so meldet der Browser den Upload-Fortschritt.
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents/upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        const body = xhr.response as { error?: string } | null;
        reject(new Error(body?.error ?? t("shell.files.upload.failedStatus", { status: xhr.status })));
      }
    };
    xhr.onerror = () => reject(new Error(t("shell.files.upload.offline")));
    xhr.onabort = () => reject(new Error(t("shell.files.upload.aborted")));
    xhr.send(fd);
  });
}

function useUploader({ tenantId, maxFileMb, remainingBytes, t }: { tenantId: string; maxFileMb: number; remainingBytes: number | null; t: TFunction }) {
  const router = useRouter();
  const [items, setItems] = useState<UploadItem[]>([]);
  const queue = useRef<Array<{ key: number; file: File; folderId: string | null }>>([]);
  const running = useRef(false);
  const seq = useRef(0);

  const patch = (key: number, p: Partial<UploadItem>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function pump() {
    if (running.current) return;
    running.current = true;
    let done = 0;
    let failed = 0;
    while (queue.current.length) {
      const job = queue.current.shift()!;
      patch(job.key, { status: "uploading", progress: 0 });
      const fd = new FormData();
      fd.append("tenantId", tenantId);
      if (job.folderId) fd.append("folderId", job.folderId);
      fd.append("file", job.file, job.file.name);
      try {
        await uploadWithProgress(fd, (pct) => patch(job.key, { progress: pct }), t);
        patch(job.key, { status: "done", progress: 100 });
        done++;
      } catch (e) {
        patch(job.key, { status: "error", error: e instanceof Error ? e.message : t("shell.files.upload.failed") });
        failed++;
      }
    }
    running.current = false;
    if (done) {
      router.refresh();
      toast.success(done === 1 ? t("shell.files.upload.doneOne") : t("shell.files.upload.doneMany", { count: done }), failed ? { description: t("shell.files.upload.partlyFailed", { count: failed }) } : undefined);
    } else if (failed) {
      toast.error(failed === 1 ? t("shell.files.upload.failedOne") : t("shell.files.upload.failedMany", { count: failed }));
    }
  }

  function add(fileList: FileList | File[], folderId: string | null) {
    const list = Array.from(fileList);
    if (!list.length) return;
    const limit = maxFileMb * MB;
    let budget = remainingBytes;
    const next: UploadItem[] = [];
    for (const file of list) {
      const key = ++seq.current;
      let error: string | undefined;
      if (file.size === 0) error = t("shell.files.upload.empty");
      else if (file.size > limit) error = t("shell.files.upload.tooBig", { size: formatBytes(file.size), max: maxFileMb });
      else if (budget !== null && file.size > budget) error = t("shell.files.upload.noSpace");
      if (!error && budget !== null) budget -= file.size;
      next.push({ key, name: file.name, size: file.size, progress: 0, status: error ? "error" : "queued", error });
      if (!error) queue.current.push({ key, file, folderId });
    }
    setItems((prev) => [...prev.filter((i) => i.status === "queued" || i.status === "uploading"), ...next]);
    void pump();
  }

  const busy = items.some((i) => i.status === "queued" || i.status === "uploading");
  const clear = () => setItems((prev) => prev.filter((i) => i.status === "queued" || i.status === "uploading"));
  return { items, add, busy, clear };
}

function UploadList({ items, onClear, busy, t }: { items: UploadItem[]; onClear: () => void; busy: boolean; t: TFunction }) {
  if (!items.length) return null;
  return (
    <Card className="animate-rise mb-4 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{busy ? t("shell.files.upload.busy") : t("shell.files.upload.finished")}</p>
        {!busy ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClear} className="min-h-11">
            <X className="h-4 w-4" aria-hidden /> {t("shell.files.upload.hide")}
          </Button>
        ) : null}
      </div>
      <ul className="space-y-2" aria-live="polite">
        {items.map((i) => (
          <li key={i.key} className="text-sm">
            <div className="flex items-center gap-2">
              <span className="shrink-0" aria-hidden>
                {i.status === "done" ? <CheckCircle2 className="h-4 w-4 text-ok" /> : i.status === "error" ? <AlertCircle className="h-4 w-4 text-danger" /> : <Spinner className="text-ink-3" />}
              </span>
              <span className="min-w-0 flex-1 truncate">{i.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-ink-3">{i.status === "uploading" ? `${i.progress}%` : formatBytes(i.size)}</span>
            </div>
            {i.status === "uploading" || i.status === "queued" ? (
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={t("shell.files.upload.progress", { name: i.name })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={i.progress}>
                <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${i.progress}%` }} />
              </div>
            ) : null}
            {i.error ? <p className="mt-0.5 pl-6 text-xs text-danger">{i.error}</p> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ----------------------------------------------------------------- Ordner */

function FolderForm({ mode, folder, parentId, parentRole, onDone, t }: { mode: "create" | "edit"; folder?: { id: string; name: string; minRole: string }; parentId: string | null; parentRole: string | null; onDone: (id: string | null) => void; t: TFunction }) {
  const [state, formAction, pending] = useActionState(async (prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> => {
    const r = mode === "create" ? await createFolderAction(prev, fd) : ((await updateFolderAction(null, fd)) as ActionResult<{ id: string }>);
    if (r.ok) {
      if (r.message) toast.success(r.message);
      onDone(r.data?.id ?? null);
    }
    return r;
  }, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form onSubmit={submitKeepingValues(formAction)} className="space-y-4 pb-2">
      {folder ? <input type="hidden" name="id" value={folder.id} /> : null}
      {mode === "create" && parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <Field label={t("shell.files.folder.name")} error={fe?.name}>
        <Input name="name" defaultValue={folder?.name ?? ""} maxLength={80} required autoComplete="off" data-autofocus placeholder={t("shell.files.folder.namePlaceholder")} />
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-2">{t("shell.files.folder.whoSees")}</p>
        <Segmented name="minRole" label={t("shell.files.folder.visibility")} defaultValue={(folder?.minRole ?? "MEMBER") as "MEMBER"} options={FOLDER_VISIBILITY.map((v) => ({ value: v.value, label: visibilityText(v.value, t) }))} />
        {parentRole && parentRole !== "MEMBER" ? <p className="mt-1.5 text-xs text-ink-3">{t("shell.files.folder.parentRestricted", { role: visibilityText(parentRole, t) })}</p> : null}
      </div>
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} className="w-full">{mode === "create" ? t("shell.files.folder.create") : t("shell.files.folder.save")}</SubmitButton>
    </form>
  );
}

/* ------------------------------------------------------------------- Main */

export function FileBrowser({ tenantId, current, subfolders, files, moveTargets, canUpload, canManage, maxFileMb, remainingBytes, q, locale = "de" }: Props) {
  const t = useMemo(() => getT(locale), [locale]);
  const { pending, run, router } = useRun(t);
  const uploader = useUploader({ tenantId, maxFileMb, remainingBytes, t });
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [menuFor, setMenuFor] = useState<BrowserFile | null>(null);
  const [preview, setPreview] = useState<BrowserFile | null>(null);
  const [renameFor, setRenameFor] = useState<BrowserFile | null>(null);
  const [moveFor, setMoveFor] = useState<BrowserFile | null>(null);
  const [folderDialog, setFolderDialog] = useState<null | { mode: "create" } | { mode: "edit"; folder: { id: string; name: string; minRole: string } }>(null);

  const folderId = current?.id ?? null;
  const searching = q.length > 0;
  const allowDrop = canUpload && !searching;

  function onDragEnter(e: React.DragEvent) {
    if (!allowDrop || !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }
  function onDragLeave(e: React.DragEvent) {
    if (!allowDrop) return;
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }
  function onDragOver(e: React.DragEvent) {
    if (!allowDrop || !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
  function onDrop(e: React.DragEvent) {
    if (!allowDrop) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (e.dataTransfer.files?.length) uploader.add(e.dataTransfer.files, folderId);
  }

  async function removeFile(f: BrowserFile) {
    setMenuFor(null);
    const okd = await confirmDialog({ title: t("shell.files.delete.title"), message: t("shell.files.delete.message", { name: f.name }), tone: "danger", confirmLabel: t("shell.files.action.delete") });
    if (okd) await run(() => deleteFileAction(f.id));
  }

  async function removeFolder() {
    if (!current) return;
    const okd = await confirmDialog({
      title: t("shell.files.deleteFolder.title"),
      message: t("shell.files.deleteFolder.message", { name: current.name }),
      tone: "danger",
      confirmLabel: t("shell.files.deleteFolder.confirm"),
    });
    if (!okd) return;
    await run(
      () => deleteFolderAction(current.id),
      (r) => router.push(folderHref(r.ok ? ((r.data as { parentId: string | null } | undefined)?.parentId ?? null) : null)),
    );
  }

  const empty = subfolders.length === 0 && files.length === 0;

  return (
    <div onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop} className="relative">
      {/* Suche */}
      <form action="/files" method="get" role="search" className="mb-3 flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t("shell.files.search.label")}</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input name="q" type="search" defaultValue={q} placeholder={t("shell.files.search.placeholder")} maxLength={100} className="pl-10" enterKeyHint="search" />
        </label>
        {searching ? (
          <Link href={folderHref(null)} className={buttonClasses("secondary", "md")} aria-label={t("shell.files.search.end")}>
            <X className="h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <Button type="submit" variant="secondary" aria-label={t("shell.files.search.submit")}>
            <Search className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </form>

      {/* Pfad */}
      {!searching ? (
        <nav aria-label={t("shell.files.path")} className="mb-3 -mx-1 flex items-center gap-0.5 overflow-x-auto text-sm [scrollbar-width:none]">
          <Link href="/files" className={cn("inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-2", current ? "text-ink-3 hover:text-ink" : "font-semibold")} aria-current={current ? undefined : "page"}>
            <Home className="h-4 w-4" aria-hidden /> {t("shell.files.allFolders")}
          </Link>
          {current?.path.map((p, i) => {
            const last = i === current.path.length - 1;
            return (
              <span key={p.id} className="flex shrink-0 items-center">
                <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
                <Link href={folderHref(p.id)} aria-current={last ? "page" : undefined} className={cn("inline-flex min-h-11 max-w-[14rem] items-center truncate rounded-control px-2", last ? "font-semibold" : "text-ink-3 hover:text-ink")}>
                  <span className="truncate">{p.name}</span>
                </Link>
              </span>
            );
          })}
        </nav>
      ) : (
        <p className="mb-3 text-sm text-ink-3">{t("shell.files.search.results", { q })}</p>
      )}

      {/* Werkzeuge */}
      {!searching && (canUpload || canManage) ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {canUpload ? (
            <>
              <Button type="button" onClick={() => inputRef.current?.click()} className="flex-1 sm:flex-none">
                <Upload className="h-4 w-4" aria-hidden /> {t("shell.files.upload.button")}
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  if (e.currentTarget.files) uploader.add(e.currentTarget.files, folderId);
                  e.currentTarget.value = "";
                }}
              />
            </>
          ) : null}
          {canManage ? (
            <Button type="button" variant="secondary" onClick={() => setFolderDialog({ mode: "create" })} className="flex-1 sm:flex-none">
              <FolderPlus className="h-4 w-4" aria-hidden /> {t("shell.files.folder.new")}
            </Button>
          ) : null}
          {canManage && current ? (
            <Button type="button" variant="secondary" onClick={() => setFolderDialog({ mode: "edit", folder: { id: current.id, name: current.name, minRole: current.minRole } })} aria-label={t("shell.files.folder.edit")}>
              <Settings2 className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">{t("shell.files.folder.edit")}</span>
            </Button>
          ) : null}
        </div>
      ) : null}

      {current && current.effectiveMinRole !== "MEMBER" ? (
        <Alert tone="info" className="mb-4" icon={<FolderLock className="h-4 w-4" />}>
          {t("shell.files.folder.restricted", { role: visibilityText(current.effectiveMinRole, t) })}
        </Alert>
      ) : null}

      <UploadList items={uploader.items} busy={uploader.busy} onClear={uploader.clear} t={t} />

      {allowDrop ? (
        <p className="mb-3 text-xs text-ink-3">
          <span className="hidden md:inline">{t("shell.files.dropTip")} </span>{t("shell.files.maxPerFile", { max: maxFileMb })}
        </p>
      ) : null}

      {empty ? (
        searching ? (
          <EmptyState icon={<Search className="h-5 w-5" />} title={t("shell.files.empty.noHits")} text={t("shell.files.empty.noHitsText")} />
        ) : (
          <EmptyState
            icon={<Folder className="h-5 w-5" />}
            title={current ? t("shell.files.empty.folder") : t("shell.files.empty.none")}
            text={canUpload ? t("shell.files.empty.uploadText") : t("shell.files.empty.memberText")}
            action={
              canUpload ? (
                <Button type="button" onClick={() => inputRef.current?.click()}>
                  <Upload className="h-4 w-4" aria-hidden /> {t("shell.files.upload.one")}
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {subfolders.map((f) => (
            <Link key={f.id} href={folderHref(f.id)} className="press flex min-h-16 items-center gap-3 px-4 py-2.5 hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent" aria-hidden>
                {f.effectiveMinRole !== "MEMBER" ? <FolderLock className="h-5 w-5" /> : <Folder className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{f.name}</span>
                <span className="block text-xs text-ink-3">
                  {f.fileCount === 1 ? t("shell.files.count.fileOne") : t("shell.files.count.fileMany", { count: f.fileCount })}
                  {f.folderCount ? ` · ${f.folderCount === 1 ? t("shell.files.count.folderOne") : t("shell.files.count.folderMany", { count: f.folderCount })}` : ""}
                </span>
              </span>
              {f.minRole !== "MEMBER" ? <Badge tone="warn" className="shrink-0">{visibilityText(f.minRole, t)}</Badge> : null}
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
            </Link>
          ))}
          {files.map((f) => {
            const pk = previewKind(f.mimeType, f.name);
            const body = (
              <>
                <FileTypeIcon mimeType={f.mimeType} name={f.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.name}</span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
                    <span className="shrink-0 tabular-nums">{formatBytes(f.sizeBytes)}</span>
                    <span aria-hidden>·</span>
                    <span className="shrink-0">{f.createdLabel}</span>
                    {f.uploaderName ? (
                      <>
                        <span aria-hidden>·</span>
                        <Avatar name={f.uploaderName} src={f.uploaderAvatar} size={18} tone="soft" />
                        <span className="truncate">{f.uploaderName}</span>
                      </>
                    ) : null}
                  </span>
                  {searching && f.folderPath ? <span className="block truncate text-xs text-ink-3">{t("shell.files.inFolder", { path: f.folderPath })}</span> : null}
                </span>
              </>
            );
            return (
              <div key={f.id} className="flex items-center">
                {pk ? (
                  <button type="button" onClick={() => setPreview(f)} className="press flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 pr-2 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent" aria-label={t("shell.files.aria.view", { name: f.name })}>
                    {body}
                  </button>
                ) : (
                  <a href={fileUrl(f.id, true)} className="press flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 pr-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent" aria-label={t("shell.files.aria.download", { name: f.name })}>
                    {body}
                  </a>
                )}
                <button type="button" onClick={() => setMenuFor(f)} className="press mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent" aria-label={t("shell.files.aria.actions", { name: f.name })}>
                  <MoreVertical className="h-5 w-5" aria-hidden />
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {/* Drag & Drop Overlay */}
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-card border-2 border-dashed border-accent bg-accent-soft/80">
          <p className="flex items-center gap-2 rounded-control bg-surface px-4 py-3 font-medium shadow">
            <Upload className="h-5 w-5 text-accent" aria-hidden /> {current ? t("shell.files.dropInto", { name: current.name }) : t("shell.files.drop")}
          </p>
        </div>
      ) : null}

      {/* Aktionen pro Datei */}
      <Dialog open={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.name ?? t("shell.files.file")} description={menuFor ? `${formatBytes(menuFor.sizeBytes)} · ${menuFor.createdLabel}` : undefined} size="sm">
        {menuFor ? (
          <div className="-mx-2 flex flex-col pb-2">
            {previewKind(menuFor.mimeType, menuFor.name) ? (
              <MenuButton icon={<Eye className="h-5 w-5" />} onClick={() => { setPreview(menuFor); setMenuFor(null); }}>{t("shell.files.action.view")}</MenuButton>
            ) : null}
            <MenuLink icon={<Download className="h-5 w-5" />} href={fileUrl(menuFor.id, true)} onClick={() => setMenuFor(null)}>{t("shell.files.action.download")}</MenuLink>
            {menuFor.canEdit ? (
              <>
                <MenuButton icon={<Pencil className="h-5 w-5" />} onClick={() => { setRenameFor(menuFor); setMenuFor(null); }}>{t("shell.files.action.rename")}</MenuButton>
                <MenuButton icon={<FolderInput className="h-5 w-5" />} onClick={() => { setMoveFor(menuFor); setMenuFor(null); }}>{t("shell.files.action.move")}</MenuButton>
                <MenuButton icon={<Trash2 className="h-5 w-5" />} danger onClick={() => void removeFile(menuFor)}>{t("shell.files.action.delete")}</MenuButton>
              </>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      {/* Vorschau */}
      <Dialog
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.name ?? t("shell.files.preview")}
        size="lg"
        footer={
          preview ? (
            <>
              <a href={fileUrl(preview.id)} target="_blank" rel="noopener" className={buttonClasses("secondary", "lg", "w-full sm:w-auto sm:h-11")}>
                <ExternalLink className="h-4 w-4" aria-hidden /> {t("shell.files.newTab")}
              </a>
              <a href={fileUrl(preview.id, true)} className={buttonClasses("primary", "lg", "w-full sm:w-auto sm:h-11")}>
                <Download className="h-4 w-4" aria-hidden /> {t("shell.files.action.download")}
              </a>
            </>
          ) : undefined
        }
      >
        {preview ? (
          previewKind(preview.mimeType, preview.name) === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl(preview.id)} alt={preview.name} className="mx-auto max-h-[60dvh] w-auto max-w-full rounded-control bg-surface-2 object-contain" />
          ) : (
            <iframe src={fileUrl(preview.id)} title={preview.name} className="h-[60dvh] w-full rounded-control border border-line bg-surface-2" />
          )
        ) : null}
      </Dialog>

      {/* Umbenennen */}
      <Dialog open={!!renameFor} onClose={() => setRenameFor(null)} title={t("shell.files.rename.title")} size="sm">
        {renameFor ? (
          <form
            key={renameFor.id}
            className="space-y-4 pb-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get("name") ?? "");
              const okd = await run(() => renameFileAction(renameFor.id, name));
              if (okd) setRenameFor(null);
            }}
          >
            <Field label={t("shell.files.rename.label")}>
              <Input name="name" defaultValue={renameFor.name} maxLength={191} required autoComplete="off" data-autofocus />
            </Field>
            <SubmitButton pending={pending} className="w-full">{t("shell.files.action.rename")}</SubmitButton>
          </form>
        ) : null}
      </Dialog>

      {/* Verschieben */}
      <Dialog open={!!moveFor} onClose={() => setMoveFor(null)} title={t("shell.files.move.title")} description={moveFor ? `«${moveFor.name}»` : undefined} size="sm">
        {moveFor ? (
          <form
            key={moveFor.id}
            className="space-y-4 pb-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const target = String(new FormData(e.currentTarget).get("folderId") ?? "");
              const okd = await run(() => moveFileAction(moveFor.id, target || null));
              if (okd) setMoveFor(null);
            }}
          >
            <Field label={t("shell.files.move.target")}>
              <Select name="folderId" defaultValue={moveFor.folderId ?? ""}>
                <option value="">{t("shell.files.move.root")}</option>
                {moveTargets.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </Select>
            </Field>
            <SubmitButton pending={pending} className="w-full">{t("shell.files.action.move")}</SubmitButton>
          </form>
        ) : null}
      </Dialog>

      {/* Ordner anlegen / bearbeiten */}
      <Dialog
        open={!!folderDialog}
        onClose={() => setFolderDialog(null)}
        title={folderDialog?.mode === "edit" ? t("shell.files.folder.edit") : t("shell.files.folder.new")}
        description={folderDialog?.mode === "create" && current ? t("shell.files.folder.inParent", { name: current.name }) : undefined}
        size="sm"
      >
        {folderDialog ? (
          <>
            <FolderForm
              key={folderDialog.mode === "edit" ? folderDialog.folder.id : "new"}
              mode={folderDialog.mode}
              folder={folderDialog.mode === "edit" ? folderDialog.folder : undefined}
              parentId={folderDialog.mode === "create" ? folderId : null}
              parentRole={folderDialog.mode === "create" ? current?.effectiveMinRole ?? null : null}
              t={t}
              onDone={(id) => {
                setFolderDialog(null);
                if (id) router.push(folderHref(id));
                else router.refresh();
              }}
            />
            {folderDialog.mode === "edit" ? (
              <div className="mt-2 border-t border-line pt-3 pb-2">
                <Button type="button" variant="ghost" className="w-full text-danger" disabled={pending} onClick={() => { setFolderDialog(null); void removeFolder(); }}>
                  <Trash2 className="h-4 w-4" aria-hidden /> {t("shell.files.deleteFolder.confirm")}
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </Dialog>
    </div>
  );
}

function MenuButton({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("press flex min-h-12 items-center gap-3 rounded-control px-3 text-left text-[15px] font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent", danger && "text-danger")}>
      <span aria-hidden className={danger ? "text-danger" : "text-ink-3"}>{icon}</span>
      {children}
    </button>
  );
}

function MenuLink({ icon, children, href, onClick }: { icon: React.ReactNode; children: React.ReactNode; href: string; onClick: () => void }) {
  return (
    <a href={href} onClick={onClick} className="press flex min-h-12 items-center gap-3 rounded-control px-3 text-[15px] font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
      <span aria-hidden className="text-ink-3">{icon}</span>
      {children}
    </a>
  );
}
