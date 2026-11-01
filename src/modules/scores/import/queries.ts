import "server-only";
import { db } from "@/lib/db";

export type PreviousImportMatch = { id: string; title: string | null; date: Date };
export type ScoreImportListItem = {
  id: string;
  fileName: string;
  format: string;
  rows: number;
  createdAt: Date;
  createdByName: string | null;
  matches: Array<PreviousImportMatch & { participants: number }>;
};

function splitIds(raw: string | null): string[] {
  return (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
}

/** Importverlauf des Vereins (neueste zuerst) mit Links zu den erstellten Durchgängen. */
export async function listScoreImports(tenantId: string, limit = 30): Promise<ScoreImportListItem[]> {
  const imports = await db.scoreImport.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: limit });
  const matchIds = [...new Set(imports.flatMap((i) => splitIds(i.matchIds)))];
  const userIds = [...new Set(imports.map((i) => i.createdById).filter((x): x is string => !!x))];
  const [matches, users] = await Promise.all([
    matchIds.length
      ? db.match.findMany({ where: { id: { in: matchIds }, tenantId }, select: { id: true, title: true, date: true, _count: { select: { participants: true } } } })
      : Promise.resolve([]),
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const userById = new Map(users.map((u) => [u.id, u.name]));
  return imports.map((i) => ({
    id: i.id,
    fileName: i.fileName,
    format: i.format,
    rows: i.rows,
    createdAt: i.createdAt,
    createdByName: i.createdById ? (userById.get(i.createdById) ?? null) : null,
    // Gelöschte Durchgänge erscheinen nicht mehr
    matches: splitIds(i.matchIds)
      .map((id) => matchById.get(id))
      .filter((m): m is NonNullable<typeof m> => !!m)
      .map((m) => ({ id: m.id, title: m.title, date: m.date, participants: m._count.participants })),
  }));
}

/**
 * Früherer Import derselben Datei (gleicher SHA-256) im Verein. `matches` leer = alle damals
 * erstellten Durchgänge wurden gelöscht: der Eintrag sperrt dann nicht mehr (siehe `isStaleImport`).
 */
export async function findPreviousImport(tenantId: string, fileHash: string) {
  const prev = await db.scoreImport.findUnique({ where: { tenantId_fileHash: { tenantId, fileHash } } });
  if (!prev) return null;
  const ids = splitIds(prev.matchIds);
  const matches = ids.length ? await db.match.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, title: true, date: true } }) : [];
  return { id: prev.id, fileName: prev.fileName, createdAt: prev.createdAt, matches };
}
export type PreviousImport = NonNullable<Awaited<ReturnType<typeof findPreviousImport>>>;

/** Alle Durchgänge des früheren Imports gelöscht: dieselbe Datei darf erneut importiert werden. */
export function isStaleImport(prev: PreviousImport): boolean {
  return prev.matches.length === 0;
}
