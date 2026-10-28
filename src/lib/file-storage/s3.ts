import "server-only";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { assertTenantKey, buildTestKey } from "./keys";
import { assertPublicHost, isPrivateAddressError, parseStorageUrl, storageHttpAgent, storageHttpsAgent } from "./net";
import { StorageError, type GetResult, type PutOptions, type S3Credentials, type StorageAdapter } from "./types";

const clients = new Map<string, S3Client>();

function clientFor(c: S3Credentials) {
  const id = createHash("sha256").update(JSON.stringify([c.endpoint ?? "", c.region, c.accessKeyId, c.secretAccessKey, c.forcePathStyle])).digest("hex");
  let client = clients.get(id);
  if (!client) {
    client = new S3Client({
      region: c.region || "us-east-1",
      endpoint: c.endpoint || undefined,
      forcePathStyle: c.forcePathStyle,
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
      // Viele S3-kompatible Anbieter kennen die neuen Standard-Prüfsummen nicht.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      maxAttempts: 2,
      // DNS-Prüfung beim Verbindungsaufbau (Schutz gegen DNS-Rebinding auf interne Adressen).
      requestHandler: { httpsAgent: storageHttpsAgent, httpAgent: storageHttpAgent },
    });
    if (clients.size > 50) clients.clear();
    clients.set(id, client);
  }
  return client;
}

export function normalisePrefix(prefix: string | undefined) {
  const p = (prefix ?? "").trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (!p) return "";
  if (!/^[A-Za-z0-9._\-/]+$/.test(p) || p.split("/").some((s) => s === "" || s === "." || s === "..")) {
    throw new StorageError("Präfix: nur Buchstaben, Ziffern, Punkt, Bindestrich und / verwenden.", "INVALID");
  }
  return p + "/";
}

function mapError(e: unknown, bucket: string): StorageError {
  if (e instanceof StorageError) return e;
  if (isPrivateAddressError(e)) return new StorageError("Endpoint: Interne Adressen sind nicht erlaubt.", "INVALID");
  if (e instanceof S3ServiceException) {
    switch (e.name) {
      case "NoSuchKey":
      case "NotFound":
        return new StorageError("Die Datei wurde im S3-Speicher nicht gefunden.", "NOT_FOUND");
      case "NoSuchBucket":
        return new StorageError(`Der Bucket «${bucket}» existiert nicht. Name und Region prüfen.`, "INVALID");
      case "InvalidAccessKeyId":
      case "SignatureDoesNotMatch":
      case "InvalidClientTokenId":
        return new StorageError("Zugangsschlüssel oder Secret Key ist falsch.", "AUTH");
      case "AccessDenied":
      case "Forbidden":
        return new StorageError("Zugriff verweigert. Hat der Schlüssel Lese- und Schreibrechte auf den Bucket?", "AUTH");
      case "PermanentRedirect":
      case "AuthorizationHeaderMalformed":
        return new StorageError("Falsche Region für diesen Bucket.", "INVALID");
      default:
        return new StorageError(`S3-Speicher meldet einen Fehler (${e.name}).`, "UNKNOWN");
    }
  }
  const code = typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
  if (["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"].includes(code)) {
    return new StorageError("Der S3-Speicher ist nicht erreichbar. Endpoint prüfen.", "NETWORK");
  }
  return new StorageError("Unbekannter Fehler beim S3-Speicher.", "UNKNOWN");
}

/** AWS S3, Hetzner Object Storage und andere S3-kompatible Speicher. */
export class S3StorageAdapter implements StorageAdapter {
  readonly provider = "S3" as const;
  private readonly prefix: string;

  constructor(
    private readonly tenantId: string,
    private readonly creds: S3Credentials,
  ) {
    if (!creds.bucket || !creds.accessKeyId || !creds.secretAccessKey) {
      throw new StorageError("S3-Zugangsdaten sind unvollständig. Bitte in der Verwaltung ergänzen.", "NOT_CONFIGURED");
    }
    this.prefix = normalisePrefix(creds.prefix);
  }

  private async ready() {
    if (this.creds.endpoint) await assertPublicHost(parseStorageUrl(this.creds.endpoint, "Endpoint"), "Endpoint");
    return clientFor(this.creds);
  }

  private objectKey(key: string) {
    assertTenantKey(this.tenantId, key);
    return this.prefix + key;
  }

  async put(key: string, body: Buffer | ReadableStream<Uint8Array>, opts: PutOptions) {
    const Key = this.objectKey(key);
    const client = await this.ready();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: this.creds.bucket,
          Key,
          Body: Buffer.isBuffer(body) ? body : Readable.fromWeb(body as import("node:stream/web").ReadableStream<Uint8Array>),
          ContentType: opts.contentType,
          ContentLength: opts.size,
        }),
      );
    } catch (e) {
      throw mapError(e, this.creds.bucket);
    }
  }

  async get(key: string): Promise<GetResult> {
    const Key = this.objectKey(key);
    const client = await this.ready();
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: this.creds.bucket, Key }));
      if (!res.Body) throw new StorageError("Die Datei ist leer oder fehlt.", "NOT_FOUND");
      return {
        stream: res.Body.transformToWebStream() as ReadableStream<Uint8Array>,
        size: typeof res.ContentLength === "number" ? res.ContentLength : null,
        contentType: res.ContentType ?? null,
      };
    } catch (e) {
      throw mapError(e, this.creds.bucket);
    }
  }

  async delete(key: string) {
    const Key = this.objectKey(key);
    const client = await this.ready();
    try {
      await client.send(new DeleteObjectCommand({ Bucket: this.creds.bucket, Key }));
    } catch (e) {
      const err = mapError(e, this.creds.bucket);
      if (err.code !== "NOT_FOUND") throw err;
    }
  }

  async test() {
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
