// Kleiner IndexedDB-Wrapper ohne Abhängigkeiten.
// ACHTUNG: Name, Version und Stores müssen mit public/sw.js übereinstimmen.

export const DB_NAME = "standchef-offline";
export const DB_VERSION = 1;
export const STORES = { outbox: "outbox", snapshot: "snapshot", matches: "matches", meta: "meta" } as const;
export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

export function idbSupported() {
  return typeof indexedDB !== "undefined";
}

export function openDb(): Promise<IDBDatabase> {
  if (!idbSupported()) return Promise.reject(new Error("IndexedDB nicht verfügbar"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.outbox)) {
        const s = db.createObjectStore(STORES.outbox, { keyPath: "key" });
        s.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(STORES.snapshot)) db.createObjectStore(STORES.snapshot, { keyPath: "tenantId" });
      if (!db.objectStoreNames.contains(STORES.matches)) db.createObjectStore(STORES.matches, { keyPath: "key" });
      if (!db.objectStoreNames.contains(STORES.meta)) db.createObjectStore(STORES.meta, { keyPath: "key" });
    };
    req.onsuccess = () => {
      const db = req.result;
      // Andere Version (z.B. neuer Tab nach Update): Verbindung freigeben
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error("IndexedDB konnte nicht geöffnet werden"));
    };
    req.onblocked = () => {
      // Ein alter Tab hält die DB offen; Anfrage bleibt bestehen, bis er schliesst.
    };
  });
  return dbPromise;
}

export function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Führt `fn` in einer Transaktion aus und löst erst auf, wenn die Transaktion abgeschlossen ist
 * (Daten sind dann dauerhaft geschrieben). In `fn` nur IndexedDB-Anfragen awaiten.
 */
export async function withTx<T>(stores: StoreName[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => Promise<T> | T): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(stores, mode, mode === "readwrite" ? { durability: "strict" } : undefined);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Transaktion abgebrochen"));
    tx.onerror = () => reject(tx.error ?? new Error("Transaktionsfehler"));
  });
  let result: T;
  try {
    result = await fn(tx);
  } catch (e) {
    try {
      tx.abort();
    } catch {
      // bereits beendet
    }
    await done.catch(() => undefined);
    throw e;
  }
  await done;
  return result;
}

export function idbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return withTx([store], "readonly", (tx) => promisify(tx.objectStore(store).get(key)) as Promise<T | undefined>);
}

export function idbGetAll<T>(store: StoreName): Promise<T[]> {
  return withTx([store], "readonly", (tx) => promisify(tx.objectStore(store).getAll()) as Promise<T[]>);
}

export function idbPut<T>(store: StoreName, value: T): Promise<void> {
  return withTx([store], "readwrite", async (tx) => {
    await promisify(tx.objectStore(store).put(value));
  });
}

export function idbDelete(store: StoreName, key: IDBValidKey): Promise<void> {
  return withTx([store], "readwrite", async (tx) => {
    await promisify(tx.objectStore(store).delete(key));
  });
}

export function idbClear(stores: StoreName[]): Promise<void> {
  return withTx(stores, "readwrite", async (tx) => {
    for (const s of stores) await promisify(tx.objectStore(s).clear());
  });
}

/** Zufällige ID (UUID v4), mit Fallback für ältere Browser bzw. unsichere Kontexte. */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
