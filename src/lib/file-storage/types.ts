/**
 * Gemeinsame Typen der Dateiablage. Bewusst ohne "server-only", damit auch
 * Client-Komponenten (Admin-Formular) die Konstanten nutzen können.
 */

export const STORAGE_PROVIDERS = ["LOCAL", "S3", "WEBDAV"] as const;
export type StorageProviderKey = (typeof STORAGE_PROVIDERS)[number];

export function isStorageProvider(v: string): v is StorageProviderKey {
  return (STORAGE_PROVIDERS as readonly string[]).includes(v);
}

export const STORAGE_PROVIDER_LABELS: Record<StorageProviderKey, string> = {
  LOCAL: "Server",
  S3: "S3-Speicher",
  WEBDAV: "Nextcloud / WebDAV",
};

/** Varianten im Admin-Formular. Alle S3-Varianten speichern als Provider "S3". */
export const S3_VARIANTS = ["AWS", "HETZNER", "COMPAT"] as const;
export type S3Variant = (typeof S3_VARIANTS)[number];

export const HETZNER_REGIONS = [
  { value: "fsn1", label: "Falkenstein (fsn1)" },
  { value: "nbg1", label: "Nürnberg (nbg1)" },
  { value: "hel1", label: "Helsinki (hel1)" },
] as const;

export function hetznerEndpoint(region: string) {
  return `https://${region}.your-objectstorage.com`;
}

export type S3Credentials = {
  variant: S3Variant;
  /** leer = AWS-Standard-Endpoint */
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  /** optionaler Unterordner im Bucket, z.B. "standchef/" */
  prefix?: string;
};

export type WebdavCredentials = {
  /** z.B. https://cloud.example.ch/remote.php/dav/files/<user>/<ordner> */
  url: string;
  username: string;
  password: string;
};

/**
 * Inhalt von StorageConfig.credentialsEnc (verschlüsselt). Zugangsdaten aller Anbieter
 * bleiben erhalten, auch wenn der aktive Anbieter wechselt – so bleiben ältere Dateien lesbar.
 */
export type StorageCredentialsBundle = {
  s3?: S3Credentials;
  webdav?: WebdavCredentials;
};

export type PutOptions = { contentType: string; size: number };

export type GetResult = {
  stream: ReadableStream<Uint8Array>;
  size: number | null;
  contentType: string | null;
};

export interface StorageAdapter {
  readonly provider: StorageProviderKey;
  put(key: string, body: Buffer | ReadableStream<Uint8Array>, opts: PutOptions): Promise<void>;
  get(key: string): Promise<GetResult>;
  delete(key: string): Promise<void>;
  /** Schreibt, liest und löscht ein kleines Testobjekt. Wirft StorageError mit verständlicher Meldung. */
  test(): Promise<void>;
}

/** Fehler mit einer Meldung, die direkt in der Oberfläche angezeigt werden darf. */
export class StorageError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_CONFIGURED" | "NOT_FOUND" | "AUTH" | "NETWORK" | "INVALID" | "UNKNOWN" = "UNKNOWN",
  ) {
    super(message);
    this.name = "StorageError";
  }
}
