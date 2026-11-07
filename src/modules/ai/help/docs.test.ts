import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { capDocs, loadSupportDocs } from "./docs";

describe("support docs", () => {
  it("caps each file and the total size", () => {
    const out = capDocs([{ name: "a", text: "x".repeat(1000) }, { name: "b", text: "y".repeat(1000) }, { name: "c", text: "z".repeat(1000) }], 600, 1500);
    expect(out.map((d) => d.name)).toEqual(["a", "b", "c"]);
    expect(out[0]!.text.startsWith("x".repeat(600))).toBe(true);
    expect(out[0]!.text).toContain("[… truncated]");
    const total = out.reduce((n, d) => n + d.text.length, 0);
    expect(total).toBeLessThanOrEqual(1500 + 3 * 20);
  });

  it("reads README.md and docs/*.md from the project folder", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "sc-docs-"));
    await writeFile(path.join(dir, "README.md"), "# Readme\r\nHallo");
    await mkdir(path.join(dir, "docs"));
    await writeFile(path.join(dir, "docs", "B.md"), "B");
    await writeFile(path.join(dir, "docs", "A.md"), "A");
    await writeFile(path.join(dir, "docs", "secret.env"), "KEY=1");
    const docs = await loadSupportDocs(dir);
    expect(docs.map((d) => d.name)).toEqual(["README.md", "docs/A.md", "docs/B.md"]);
    expect(docs[0]!.text).toBe("# Readme\nHallo");
  });
});
