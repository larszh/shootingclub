import "server-only";
import { assertTenantKey, buildTestKey } from "./keys";
import { assertPublicHost, parseStorageUrl } from "./net";
import { StorageError, type GetResult, type PutOptions, type StorageAdapter, type WebdavCredentials } from "./types";

const TIMEOUT_MS = 60_000;
/** Bereits angelegte Ordner pro Basis-URL (lange laufender Node-Prozess). */
const knownCollections = new Set<string>();

function statusError(status: number, what: string): StorageError {
  if (status === 401) return new StorageError("Benutzername oder App-Passwort ist falsch.", "AUTH");
  if (status === 403) return new StorageError("Zugriff verweigert. Hat das Konto Schreibrechte auf den Ordner?", "AUTH");
  if (status === 404) return new StorageError(`${what}: nicht gefunden. Stimmt die WebDAV-Adresse?`, "NOT_FOUND");
  if (status === 405) return new StorageError("Diese Adresse ist kein WebDAV-Ordner. Bitte die WebDAV-Adresse aus Nextcloud verwenden.", "INVALID");
  if (status === 507) return new StorageError("Der Speicher in der Nextcloud ist voll.", "UNKNOWN");
  if (status >= 300 && status < 400) return new StorageError("Der Server leitet um. Bitte die genaue WebDAV-Adresse (mit https://) eintragen.", "INVALID");
  return new StorageError(`${what}: Der WebDAV-Server antwortet mit Status ${status}.`, "UNKNOWN");
}

/** Nextcloud / ownCloud / andere WebDAV-Server, umgesetzt mit fetch (PUT, GET, DELETE, MKCOL, PROPFIND). */
export class WebdavStorageAdapter implements StorageAdapter {
  readonly provider = "WEBDAV" as const;
  private readonly base: URL;
  private readonly auth: string;

  constructor(
    private readonly tenantId: string,
    creds: WebdavCredentials,
  ) {
    if (!creds.url || !creds.username || !creds.password) {
      throw new StorageError("WebDAV-Zugangsdaten sind unvollständig. Bitte in der Verwaltung ergänzen.", "NOT_CONFIGURED");
    }
    const u = parseStorageUrl(creds.url, "WebDAV-Adresse");
    u.search = "";
    u.hash = "";
    if (!u.pathname.endsWith("/")) u.pathname += "/";
    this.base = u;
    this.auth = "Basic " + Buffer.from(`${creds.username}:${creds.password}`, "utf8").toString("base64");
  }

  private urlFor(path: string) {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    return new URL(encoded, this.base).toString();
  }

  private async request(method: string, url: string, init: { body?: BodyInit; headers?: Record<string, string>; duplex?: boolean } = {}) {
    await assertPublicHost(this.base, "WebDAV-Adresse");
    try {
      return await fetch(url, {
        method,
        body: init.body,
        headers: { Authorization: this.auth, ...init.headers },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        ...(init.duplex ? { duplex: "half" } : {}),
      } as RequestInit);
    } catch (e) {
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw new StorageError("Der WebDAV-Server antwortet nicht (Zeitüberschreitung).", "NETWORK");
      throw new StorageError("Der WebDAV-Server ist nicht erreichbar. Adresse prüfen.", "NETWORK");
    }
  }

  /** Legt alle übergeordneten Ordner eines Schlüssels an (MKCOL, 405 = existiert schon). */
  private async ensureParents(key: string) {
    const parts = key.split("/").slice(0, -1);
    let acc = "";
    for (const p of parts) {
      acc += p + "/";
      const url = this.urlFor(acc);
      if (knownCollections.has(url)) continue;
      const res = await this.request("MKCOL", url);
      await res.body?.cancel();
      if (res.status === 201 || res.status === 405 || res.status === 301) {
        knownCollections.add(url);
        continue;
      }
      throw statusError(res.status, "Ordner anlegen");
    }
    if (knownCollections.size > 5000) knownCollections.clear();
  }

  async put(key: string, body: Buffer | ReadableStream<Uint8Array>, opts: PutOptions) {
    assertTenantKey(this.tenantId, key);
    await this.ensureParents(key);
    const isBuf = Buffer.isBuffer(body);
    const res = await this.request("PUT", this.urlFor(key), {
      body: isBuf ? new Uint8Array(body) : body,
      headers: { "Content-Type": opts.contentType || "application/octet-stream", "OC-Total-Length": String(opts.size) },
      duplex: !isBuf,
    });
    await res.body?.cancel();
    if (res.status !== 201 && res.status !== 204 && res.status !== 200) throw statusError(res.status, "Hochladen");
  }

  async get(key: string): Promise<GetResult> {
    assertTenantKey(this.tenantId, key);
    const res = await this.request("GET", this.urlFor(key));
    if (!res.ok || !res.body) {
      await res.body?.cancel();
      if (res.status === 404) throw new StorageError("Die Datei wurde in der Nextcloud nicht gefunden.", "NOT_FOUND");
      throw statusError(res.status, "Herunterladen");
    }
    const len = Number(res.headers.get("content-length"));
    return { stream: res.body, size: Number.isFinite(len) && len >= 0 && res.headers.has("content-length") ? len : null, contentType: res.headers.get("content-type") };
  }

  async delete(key: string) {
    assertTenantKey(this.tenantId, key);
    const res = await this.request("DELETE", this.urlFor(key));
    await res.body?.cancel();
    if (!res.ok && res.status !== 404) throw statusError(res.status, "Löschen");
  }

  async test() {
    const probe = await this.request("PROPFIND", this.base.toString(), { headers: { Depth: "0", "Content-Type": "application/xml" }, body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>' });
    await probe.body?.cancel();
    if (probe.status !== 207 && probe.status !== 200) throw statusError(probe.status, "Ordner prüfen");

    const key = buildTestKey(this.tenantId);
    const payload = Buffer.from(`Standchef Verbindungstest ${new Date().toISOString()}`);
    await this.put(key, payload, { contentType: "text/plain", size: payload.length });
    try {
      const got = await this.get(key);
      const back = Buffer.from(await new Response(got.stream).arrayBuffer());
      if (!back.equals(payload)) throw new StorageError("Die Testdatei wurde nicht korrekt zurückgelesen.", "UNKNOWN");
    } catch (e) {
      await this.delete(key).catch(() => undefined);
      throw e;
    }
    await this.delete(key);
  }
}
