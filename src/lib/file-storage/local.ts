import "server-only";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { assertTenantKey, buildTestKey, tenantKeyPrefix } from "./keys";
import { StorageError, type GetResult, type PutOptions, type StorageAdapter } from "./types";

function uploadRoot() {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR ?? "./storage/uploads");
}

/**
 * Dateien auf dem eigenen Server unter UPLOAD_DIR/tenant-files/<tenantId>/…
 * Jeder Schlüssel wird gegen das Vereinsverzeichnis geprüft (kein Path Traversal).
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly provider = "LOCAL" as const;

  constructor(private readonly tenantId: string) {}

  private resolve(key: string) {
    assertTenantKey(this.tenantId, key);
    const root = uploadRoot();
    const tenantDir = path.resolve(root, tenantKeyPrefix(this.tenantId));
    const full = path.resolve(root, key);
    if (!full.startsWith(tenantDir + path.sep)) throw new StorageError("Ungültiger Speicherpfad", "INVALID");
    return full;
  }

  async put(key: string, body: Buffer | ReadableStream<Uint8Array>, opts: PutOptions) {
    void opts;
    const full = this.resolve(key);
    try {
      await mkdir(path.dirname(full), { recursive: true });
      if (Buffer.isBuffer(body)) {
        await writeFile(full, body, { flag: "wx" });
      } else {
        await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream<Uint8Array>), createWriteStream(full, { flags: "wx" }));
      }
    } catch (e) {
      await rm(full, { force: true }).catch(() => undefined);
      throw new StorageError(`Datei konnte auf dem Server nicht gespeichert werden (${errCode(e)}).`, "UNKNOWN");
    }
  }

  async get(key: string): Promise<GetResult> {
    const full = this.resolve(key);
    let size: number;
    try {
      const s = await stat(full);
      if (!s.isFile()) throw new Error("not a file");
      size = s.size;
    } catch {
      throw new StorageError("Die Datei wurde auf dem Server nicht gefunden.", "NOT_FOUND");
    }
    const nodeStream = createReadStream(full);
    const stream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
    return { stream, size, contentType: null };
  }

  async delete(key: string) {
    const full = this.resolve(key);
    try {
      await unlink(full);
    } catch (e) {
      if (errCode(e) !== "ENOENT") throw new StorageError("Datei konnte nicht gelöscht werden.", "UNKNOWN");
    }
  }

  async test() {
    const key = buildTestKey(this.tenantId);
    const payload = Buffer.from(`Standchef Verbindungstest ${new Date().toISOString()}`);
    const full = this.resolve(key);
    try {
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, payload);
      const back = await readFile(full);
      if (!back.equals(payload)) throw new StorageError("Die Testdatei wurde nicht korrekt gelesen.", "UNKNOWN");
      await unlink(full);
    } catch (e) {
      await rm(full, { force: true }).catch(() => undefined);
      if (e instanceof StorageError) throw e;
      throw new StorageError(`Der Upload-Ordner auf dem Server ist nicht beschreibbar (${errCode(e)}).`, "UNKNOWN");
    }
  }
}

function errCode(e: unknown) {
  return typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "Fehler";
}
