/**
 * URL einer hochgeladenen Scheiben-Datei. Der Parameter `v` ändert sich, sobald die
 * Datei ersetzt wird (neuer Speicherpfad), damit Browser- und Service-Worker-Cache
 * nicht das alte Bild weiter anzeigen.
 */
export function targetFileUrl(t: { id: string; filePath: string | null }): string {
  if (!t.filePath) return `/api/files/${t.id}`;
  // FNV-1a, nur als kurzer Versionsschlüssel (Speicherpfad selbst nicht offenlegen)
  let h = 0x811c9dc5;
  for (let i = 0; i < t.filePath.length; i++) {
    h ^= t.filePath.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `/api/files/${t.id}?v=${(h >>> 0).toString(36)}`;
}

/** Content-Disposition mit ASCII-Fallback und UTF-8-Namen (RFC 6266/5987). */
export function contentDisposition(type: "inline" | "attachment", filename: string): string {
  const ascii = filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
