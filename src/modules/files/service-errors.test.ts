import { describe, expect, it, vi } from "vitest";

/** Fehlermeldungen beim Hochladen (Chat, Dokumente) in der Sprache des Mitglieds. */
const state = vi.hoisted(() => ({ settings: { maxFileMb: 2, quotaMb: null as number | null }, usedBytes: 0 }));

vi.mock("@/lib/db", () => ({ db: { storedFile: { aggregate: async () => ({ _sum: { sizeBytes: state.usedBytes }, _count: { _all: 1 } }) }, fileFolder: { findFirst: async () => null } } }));
vi.mock("@/lib/file-storage", () => {
  class StorageError extends Error {
    constructor(message: string, readonly code = "UNKNOWN") {
      super(message);
    }
  }
  return { StorageError, loadStorageSettings: async () => state.settings, buildStorageKey: () => "k", getTenantStorage: async () => ({}), getStorageForProvider: () => ({}) };
});

import { FileServiceError, fileErrorMessage, readUploadForm, saveTenantFile } from "./service";
import { StorageError } from "@/lib/file-storage";

const input = (data: Buffer, folderId?: string) => ({ tenantId: "t1", userId: "u1", name: "a.pdf", mimeType: "application/pdf", data, context: "CHAT" as const, folderId });

async function caught(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error("kein Fehler");
}

describe("fileErrorMessage", () => {
  it("übersetzt Fehler der Dateiablage, Deutsch bleibt Standard", async () => {
    const empty = await caught(saveTenantFile(input(Buffer.alloc(0))));
    expect(empty).toBeInstanceOf(FileServiceError);
    expect((empty as FileServiceError).message).toBe("Die Datei ist leer.");
    expect(fileErrorMessage(empty)).toBe("Die Datei ist leer.");
    expect(fileErrorMessage(empty, "fr")).toBe("Le fichier est vide.");
    expect(fileErrorMessage(empty, "en")).toBe("The file is empty.");

    const big = await caught(saveTenantFile(input(Buffer.alloc(3 * 1024 * 1024))));
    expect((big as FileServiceError).status).toBe(413);
    expect(fileErrorMessage(big, "it")).toMatch(/^Il file è troppo grande \(.+\)\. Sono ammessi al massimo 2 MB per file\.$/);

    const folder = await caught(saveTenantFile(input(Buffer.from("x"), "f1")));
    expect((folder as FileServiceError).status).toBe(404);
    expect(fileErrorMessage(folder, "en")).toBe("The folder no longer exists.");
  });

  it("Kontingent voll", async () => {
    state.settings = { maxFileMb: 10, quotaMb: 1 };
    state.usedBytes = 1024 * 1024;
    const e = await caught(saveTenantFile(input(Buffer.from("abc"))));
    expect(fileErrorMessage(e, "en")).toContain("The club’s storage is full");
    state.settings = { maxFileMb: 2, quotaMb: null };
    state.usedBytes = 0;
  });

  it("Upload-Formular: ungültige Anfrage und zu gross", async () => {
    const bad = await caught(readUploadForm(new Request("https://x.test", { method: "POST", body: "a", headers: { "content-type": "text/plain" } }), 2));
    expect(fileErrorMessage(bad, "fr")).toBe("Requête non valable.");
    const big = await caught(readUploadForm(new Request("https://x.test", { method: "POST", body: "a", headers: { "content-type": "multipart/form-data; boundary=x", "content-length": String(10 * 1024 * 1024) } }), 2));
    expect((big as FileServiceError).status).toBe(413);
    expect(fileErrorMessage(big, "en")).toBe("The file is too large. The maximum is 2 MB per file.");
  });

  it("Speicherfehler: Deutsch ausführlich, sonst allgemein je Art; Unbekanntes allgemein", () => {
    const e = new StorageError("Benutzername oder App-Passwort ist falsch.", "AUTH");
    expect(fileErrorMessage(e)).toBe("Benutzername oder App-Passwort ist falsch.");
    expect(fileErrorMessage(e, "en")).toBe("The storage denied access. Please let the club admins know.");
    expect(fileErrorMessage(new StorageError("x", "INVALID"), "it")).toBe("Non è stato possibile elaborare il file. Riprova.");
    expect(fileErrorMessage(new Error("intern"), "de")).toBe("Die Datei konnte nicht verarbeitet werden. Bitte nochmals versuchen.");
  });
});
