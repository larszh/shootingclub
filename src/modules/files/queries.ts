import "server-only";
import { db } from "@/lib/db";
import { roleAtLeast, isTenantRole } from "@/lib/permissions";
import { userAvatarUrl } from "@/components/avatar";
import { formatDateZurich } from "@/lib/time";
import { stricterRole } from "./types";

export type FolderNode = {
  id: string;
  parentId: string | null;
  name: string;
  minRole: string;
  /** strengste Mindestrolle auf dem Pfad bis zur Wurzel */
  effectiveMinRole: string;
  path: Array<{ id: string; name: string }>;
};

/** Alle Ordner eines Vereins mit berechneter Sichtbarkeit und Pfad (Vereine haben wenige Ordner). */
export async function loadFolderTree(tenantId: string) {
  const rows = await db.fileFolder.findMany({ where: { tenantId }, select: { id: true, parentId: true, name: true, minRole: true }, orderBy: { name: "asc" } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out = new Map<string, FolderNode>();
  const build = (id: string, depth: number): FolderNode | null => {
    const done = out.get(id);
    if (done) return done;
    const r = byId.get(id);
    if (!r || depth > 64) return null;
    const parent = r.parentId ? build(r.parentId, depth + 1) : null;
    if (r.parentId && !parent) return null; // verwaister oder zyklischer Ordner
    const node: FolderNode = {
      id: r.id,
      parentId: r.parentId,
      name: r.name,
      minRole: r.minRole,
      effectiveMinRole: parent ? stricterRole(parent.effectiveMinRole, r.minRole) : stricterRole("MEMBER", r.minRole),
      path: [...(parent?.path ?? []), { id: r.id, name: r.name }],
    };
    out.set(id, node);
    return node;
  };
  for (const r of rows) build(r.id, 0);
  return out;
}

export function canSeeFolder(node: FolderNode, role: string | null, isSuperAdmin: boolean) {
  if (isSuperAdmin) return true;
  return roleAtLeast(role, isTenantRole(node.effectiveMinRole) ? node.effectiveMinRole : "ADMIN");
}

export type FileRow = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  createdLabel: string;
  folderId: string | null;
  folderPath: string | null;
  uploadedById: string | null;
  uploaderName: string | null;
  uploaderAvatar: string | null;
};

export type FolderRow = { id: string; name: string; minRole: string; effectiveMinRole: string; fileCount: number; folderCount: number };

/** Daten für die Seite /files: Ordnerinhalt oder Suchergebnis, nur sichtbare Ordner. */
export async function getFilesView(opts: { tenantId: string; role: string | null; isSuperAdmin: boolean; folderId: string | null; q: string }) {
  const { tenantId, role, isSuperAdmin } = opts;
  const tree = await loadFolderTree(tenantId);
  const visible = [...tree.values()].filter((n) => canSeeFolder(n, role, isSuperAdmin));
  const visibleIds = new Set(visible.map((n) => n.id));

  const current = opts.folderId ? tree.get(opts.folderId) ?? null : null;
  const folderMissing = !!opts.folderId && (!current || !visibleIds.has(current.id));
  const currentId = folderMissing ? null : current?.id ?? null;

  const counts = await db.storedFile.groupBy({ by: ["folderId"], where: { tenantId, context: "FILES" }, _count: { _all: true } });
  const countByFolder = new Map(counts.map((c) => [c.folderId, c._count._all]));

  const subfolders: FolderRow[] = visible
    .filter((n) => n.parentId === currentId)
    .sort((a, b) => a.name.localeCompare(b.name, "de-CH"))
    .map((n) => ({
      id: n.id,
      name: n.name,
      minRole: n.minRole,
      effectiveMinRole: n.effectiveMinRole,
      fileCount: countByFolder.get(n.id) ?? 0,
      folderCount: visible.filter((c) => c.parentId === n.id).length,
    }));

  const q = opts.q.trim().slice(0, 100);
  // % und _ sind in LIKE Platzhalter; als normale Zeichen suchen.
  const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => "\\" + c);
  const fileWhere = q
    ? { tenantId, context: "FILES", name: { contains: escapeLike(q) }, OR: [{ folderId: null }, { folderId: { in: [...visibleIds] } }] }
    : { tenantId, context: "FILES", folderId: currentId };
  const files = await db.storedFile.findMany({
    where: fileWhere,
    orderBy: q ? [{ createdAt: "desc" }] : [{ name: "asc" }],
    take: q ? 100 : 500,
    include: { uploadedBy: { select: { id: true, name: true, avatarPath: true, updatedAt: true } } },
  });

  const folderMatches: FolderRow[] = q
    ? visible
        .filter((n) => n.name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 30)
        .map((n) => ({ id: n.id, name: n.path.map((p) => p.name).join(" / "), minRole: n.minRole, effectiveMinRole: n.effectiveMinRole, fileCount: countByFolder.get(n.id) ?? 0, folderCount: visible.filter((c) => c.parentId === n.id).length }))
    : [];

  const rows: FileRow[] = files.map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
    createdAt: f.createdAt.toISOString(),
    createdLabel: formatDateZurich(f.createdAt, { weekday: undefined }),
    folderId: f.folderId,
    folderPath: f.folderId ? tree.get(f.folderId)?.path.map((p) => p.name).join(" / ") ?? null : null,
    uploadedById: f.uploadedById,
    uploaderName: f.uploadedBy?.name ?? null,
    uploaderAvatar: f.uploadedBy ? userAvatarUrl(f.uploadedBy) : null,
  }));

  const moveTargets = visible
    .map((n) => ({ id: n.id, label: n.path.map((p) => p.name).join(" / ") }))
    .sort((a, b) => a.label.localeCompare(b.label, "de-CH"));

  return {
    current: currentId && current ? { id: current.id, name: current.name, minRole: current.minRole, effectiveMinRole: current.effectiveMinRole, parentId: current.parentId, path: current.path } : null,
    folderMissing,
    subfolders: q ? folderMatches : subfolders,
    files: rows,
    moveTargets,
    q,
  };
}

/** Statistik für die Verwaltung. */
export async function getStorageStats(tenantId: string) {
  const [byProvider, byContext, folders] = await Promise.all([
    db.storedFile.groupBy({ by: ["provider"], where: { tenantId }, _sum: { sizeBytes: true }, _count: { _all: true } }),
    db.storedFile.groupBy({ by: ["context"], where: { tenantId }, _sum: { sizeBytes: true }, _count: { _all: true } }),
    db.fileFolder.count({ where: { tenantId } }),
  ]);
  const total = byProvider.reduce((a, r) => ({ count: a.count + r._count._all, bytes: a.bytes + (r._sum.sizeBytes ?? 0) }), { count: 0, bytes: 0 });
  return {
    total,
    folders,
    byProvider: byProvider.map((r) => ({ provider: r.provider, count: r._count._all, bytes: r._sum.sizeBytes ?? 0 })),
    byContext: byContext.map((r) => ({ context: r.context, count: r._count._all, bytes: r._sum.sizeBytes ?? 0 })),
  };
}
