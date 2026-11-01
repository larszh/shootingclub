import { describe, expect, it } from "vitest";
import {
  detectScorePreset,
  findHeaderRow,
  isSighter,
  normalizeMapping,
  parseNumber,
  parseShotValue,
  readScoreFile,
  suggestLayout,
  suggestScoreMapping,
  type ScoreField,
} from "./parse";
import { buildShooters, convertShot, duplicateAssignments, evaluateShooter, parseAssignment, participantNote, SINGLE_SHOOTER_NAME, type ProgramSpec } from "./shooters";
import { foldName, matchAllMembers, matchMember, nameSimilarity } from "./fuzzy";
import { planImport } from "./plan";
import type { Stage } from "../types";

const enc = (s: string) => new TextEncoder().encode(s);
const stage = (shots: number, maxPerShot = 10, extra: Partial<Stage> = {}): Stage => ({ name: `S${shots}`, distanceM: 10, shots, maxPerShot, ...extra });
const prog = (mode: string, ...stages: Stage[]): ProgramSpec => ({ scoringMode: mode, stages });

// --- Beispiel-Exporte (vereinfacht, Formate variieren je nach Version) -----------------------

const MEYTON = [
  "Startnummer;Name;Vorname;Verein;Disziplin;Datum;Schuss;Ring;Wert;Teiler;X;Y",
  "12;Müller;Hans;SG Musterdorf;LG 10m;14.09.2026;1;10;10,4;150,2;0,12;-0,33",
  "12;Müller;Hans;SG Musterdorf;LG 10m;14.09.2026;2;9;9,8;380,0;1,02;0,40",
  "12;Müller;Hans;SG Musterdorf;LG 10m;14.09.2026;3;10;10,9;20,1;0,01;0,02",
  "15;Keller;Anna;SG Musterdorf;LG 10m;14.09.2026;1;8;8,7;900,0;-2,5;1,0",
  "15;Keller;Anna;SG Musterdorf;LG 10m;14.09.2026;2;10;10,1;250,0;0,3;0,2",
  "15;Keller;Anna;SG Musterdorf;LG 10m;14.09.2026;3;9;9,5;500,0;1,1;-1,0",
  "15;Keller;Anna;SG Musterdorf;LP 10m;14.09.2026;1;7;7,0;;;",
].join("\r\n");

const SIUS = [
  "StartNr\tNachname\tVorname\tDisziplin\tSerie\tSchuss\tWert\tX\tY",
  "101\tBrunner\tPeter\tG300\tProbe\t1\t9\t1.2\t3.4",
  "101\tBrunner\tPeter\tG300\t1\t1\t10\t0.1\t0.2",
  "101\tBrunner\tPeter\tG300\t1\t2\t9\t0.5\t1.1",
  "101\tBrunner\tPeter\tG300\t2\t1\t8\t2.0\t2.0",
  "101\tBrunner\tPeter\tG300\t2\t2\t10\t0.0\t0.3",
].join("\n");

const SHOTMARKER = [
  "ShotMarker Export",
  "String: 3 - 300m F-Class",
  "",
  "id,time,score,x (mm),y (mm),v",
  "S1,10:01:02,4,120.5,-80.0,",
  "1,10:02:00,5V,10.0,5.0,1",
  "2,10:02:40,X,1.0,2.0,1",
  "3,10:03:30,M,800.0,900.0,",
].join("\n");

const GENERIC_TOTALS = [
  "Name,Serie 1,Serie 2,Total",
  "Hans Müller,95,93,188",
  "Keller Anna,90,,90",
  "Beat Zürcher,97,96,190",
].join("\n");

describe("Datei lesen", () => {
  it("liest Meyton (Semikolon, Dezimalkomma)", () => {
    const t = readScoreFile(enc(MEYTON));
    expect(t.delimiter).toBe(";");
    expect(t.headers[0]).toBe("Startnummer");
    expect(t.rows).toHaveLength(7);
    expect(t.firstLine).toBe(2);
  });

  it("liest Windows-1252", () => {
    const bytes = new Uint8Array([...enc("Name;Total\r\nM"), 0xfc, ...enc("ller;95\r\n")]);
    const t = readScoreFile(bytes);
    expect(t.encoding).toBe("windows-1252");
    expect(t.rows[0]![0]).toBe("Müller");
  });

  it("überspringt den Vorspann von ShotMarker", () => {
    const t = readScoreFile(enc(SHOTMARKER));
    expect(t.delimiter).toBe(",");
    expect(t.headers.slice(0, 3)).toEqual(["id", "time", "score"]);
    expect(t.firstLine).toBe(4); // Leerzeilen zählen nicht
    expect(t.rows).toHaveLength(4);
  });

  it("findHeaderRow nimmt Zeile 1 ohne bekannte Spalten", () => {
    expect(findHeaderRow([["foo", "bar"], ["1", "2"]])).toBe(0);
  });

  it("lehnt leere und zu grosse Dateien ab", () => {
    expect(() => readScoreFile(new Uint8Array())).toThrow(/leer/);
    expect(() => readScoreFile(new Uint8Array(5 * 1024 * 1024 + 1))).toThrow(/5 MB/);
    expect(() => readScoreFile(enc("Name;Total\n"))).toThrow(/keine Datenzeilen/);
  });
});

describe("Werte", () => {
  it("parseNumber", () => {
    expect(parseNumber("10,5")).toBe(10.5);
    expect(parseNumber(" 9.8 ")).toBe(9.8);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNaN();
  });
  it("parseShotValue mit Kürzeln", () => {
    expect(parseShotValue("X")).toBe(10);
    expect(parseShotValue("V")).toBe(5);
    expect(parseShotValue("5V")).toBe(5);
    expect(parseShotValue("10x")).toBe(10);
    expect(parseShotValue("M")).toBe(0);
    expect(parseShotValue("10,3")).toBe(10.3);
    expect(parseShotValue("??")).toBeNaN();
  });
  it("isSighter", () => {
    expect(isSighter("Probe", "series")).toBe(true);
    expect(isSighter("P", "series")).toBe(true);
    expect(isSighter("S1", "series")).toBe(false);
    expect(isSighter("S1", "shotNo")).toBe(true);
    expect(isSighter("1", "shotNo")).toBe(false);
  });
});

describe("Vorlagen und Zuordnung", () => {
  it("Meyton: Wert (Zehntel) statt Ring, Teiler als Info", () => {
    const t = readScoreFile(enc(MEYTON));
    expect(detectScorePreset(t.headers)).toBe("meyton");
    const m = suggestScoreMapping(t.headers, "meyton");
    expect(m).toEqual(["startNo", "lastName", "firstName", "club", "discipline", "date", "shotNo", "ignore", "shotValue", "teiler", "x", "y"]);
    expect(suggestLayout(m, "meyton")).toBe("shots");
  });

  it("SIUS", () => {
    const t = readScoreFile(enc(SIUS));
    expect(detectScorePreset(t.headers)).toBe("sius");
    const m = suggestScoreMapping(t.headers, "sius");
    expect(m).toEqual(["startNo", "lastName", "firstName", "discipline", "series", "shotNo", "shotValue", "x", "y"]);
  });

  it("ShotMarker", () => {
    const t = readScoreFile(enc(SHOTMARKER));
    expect(detectScorePreset(t.headers)).toBe("shotmarker");
    const m = suggestScoreMapping(t.headers, "shotmarker");
    expect(m.slice(0, 5)).toEqual(["shotNo", "ignore", "shotValue", "x", "y"]);
  });

  it("Allgemein: Serienspalten und Total", () => {
    const t = readScoreFile(enc(GENERIC_TOTALS));
    const m = suggestScoreMapping(t.headers, "generic");
    expect(m).toEqual(["name", "seriesTotal", "seriesTotal", "total"]);
    expect(suggestLayout(m, "generic")).toBe("totals");
  });

  it("normalizeMapping: Einzelfelder nur einmal, Serientotal mehrfach", () => {
    expect(normalizeMapping(["name", "name", "seriesTotal", "seriesTotal", "bogus"], 6)).toEqual(["name", "ignore", "seriesTotal", "seriesTotal", "ignore", "ignore"]);
  });
});

describe("Schützen bilden und prüfen", () => {
  it("Meyton: Zeile pro Schuss, Disziplin-Filter, Zehntel", () => {
    const t = readScoreFile(enc(MEYTON));
    const m = suggestScoreMapping(t.headers, "meyton");
    const all = buildShooters(t, m, "shots");
    expect(all.disciplines).toEqual(["LG 10m", "LP 10m"]);
    expect(all.dates).toEqual(["2026-09-14"]);
    const lg = buildShooters(t, m, "shots", "LG 10m");
    expect(lg.shooters.map((s) => s.name)).toEqual(["Hans Müller", "Anna Keller"]);
    expect(lg.skippedRows).toBe(1);
    expect(lg.shooters[0]!.hasXY).toBe(true);

    const dec = evaluateShooter(lg.shooters[0]!, prog("RINGS_DECIMAL", stage(3)));
    expect(dec.errors).toEqual([]);
    expect(dec.stages[0]!.shots).toEqual([10.4, 9.8, 10.9]);
    expect(dec.total).toBe(31.1);

    const int = evaluateShooter(lg.shooters[0]!, prog("RINGS_INT", stage(3)));
    expect(int.stages[0]!.shots).toEqual([10, 9, 10]);
    expect(int.warnings).toContain("Zehntelwerte auf ganze Ringe abgerundet");
  });

  it("SIUS: Serien zuordnen, Probeschüsse überspringen", () => {
    const t = readScoreFile(enc(SIUS));
    const b = buildShooters(t, suggestScoreMapping(t.headers, "sius"), "shots");
    expect(b.shooters).toHaveLength(1);
    const s = b.shooters[0]!;
    expect(s.name).toBe("Peter Brunner");
    expect(s.sighters).toBe(1);
    const ev = evaluateShooter(s, prog("RINGS_INT", stage(2), stage(2)));
    expect(ev.errors).toEqual([]);
    expect(ev.stages.map((x) => x.shots)).toEqual([[10, 9], [8, 10]]);
    expect(ev.total).toBe(37);
    expect(ev.warnings).toContain("1 Probeschuss nicht übernommen");

    const tooFew = evaluateShooter(s, prog("RINGS_INT", stage(2)));
    expect(tooFew.errors[0]).toMatch(/2 Serien in der Datei/);
  });

  it("ShotMarker: ohne Name ein Schütze, X/V/M", () => {
    const t = readScoreFile(enc(SHOTMARKER));
    const b = buildShooters(t, suggestScoreMapping(t.headers, "shotmarker"), "shots");
    expect(b.shooters).toHaveLength(1);
    expect(b.shooters[0]!.name).toBe(SINGLE_SHOOTER_NAME);
    expect(b.shooters[0]!.sighters).toBe(1);
    const ev = evaluateShooter(b.shooters[0]!, prog("RINGS_INT", stage(5)));
    expect(ev.stages[0]!.shots).toEqual([5, 10, 0]);
    expect(ev.warnings).toContain("Serie 1: 3 von 5 Schüssen");
  });

  it("Schüsse ohne Serie werden der Reihe nach verteilt, zu viele = Fehler", () => {
    const csv = "Name;Schuss;Wert\nA B;1;10\nA B;2;9\nA B;3;8\nA B;4;7\nA B;5;6";
    const t = readScoreFile(enc(csv));
    const b = buildShooters(t, ["name", "shotNo", "shotValue"], "shots");
    const ev = evaluateShooter(b.shooters[0]!, prog("RINGS_INT", stage(2), stage(3)));
    expect(ev.stages.map((x) => x.shots)).toEqual([[10, 9], [8, 7, 6]]);
    const over = evaluateShooter(b.shooters[0]!, prog("RINGS_INT", stage(2), stage(2)));
    expect(over.errors[0]).toBe("5 Schüsse, das Programm hat 4");
  });

  it("Maximum pro Schuss und Trefferwertung", () => {
    expect(convertShot(11, stage(1), "RINGS_INT")).toEqual({ error: "Wert 11 über dem Maximum 10" });
    expect(convertShot(10.95, stage(1), "RINGS_DECIMAL")).toEqual({ error: "Wert 11 über dem Maximum 10.9" });
    expect(convertShot(7, stage(1), "HITS")).toEqual({ value: 1 });
    expect(convertShot(0, stage(1), "HITS")).toEqual({ value: 0 });
    expect(convertShot(-1, stage(1), "RINGS_INT")).toHaveProperty("error");
    expect(convertShot(5, stage(1), "ZONES")).toEqual({ value: 5 });
    expect(convertShot(4, stage(1), "ZONES")).toHaveProperty("error");
    // Strafzonen (negativ) sind bei Zonenwertung gültig
    expect(convertShot(-5, stage(1), "ZONES")).toEqual({ value: -5 });
  });

  it("Seriennummern: fehlende Serie verschiebt die folgenden nicht", () => {
    const csv = ["Name;Serie;Wert", "Hans Muster;2;9", "Hans Muster;2;8", "Hans Muster;3;10", "Hans Muster;3;10"].join("\n");
    const t = readScoreFile(enc(csv));
    const b = buildShooters(t, ["name", "series", "shotValue"], "shots");
    const ev = evaluateShooter(b.shooters[0]!, prog("RINGS_INT", stage(2), stage(2), stage(2)));
    expect(ev.errors).toEqual([]);
    expect(ev.stages.map((x) => [x.stageIndex, x.total])).toEqual([[1, 17], [2, 20]]);
    expect(ev.warnings.some((w) => w.startsWith("Serie 1"))).toBe(true);
    // Andere Bezeichnungen (z.B. ShotMarker-String-Nummern) der Reihe nach
    const csv2 = ["Name;Serie;Wert", "Hans Muster;12;9", "Hans Muster;14;10"].join("\n");
    const b2 = buildShooters(readScoreFile(enc(csv2)), ["name", "series", "shotValue"], "shots");
    const ev2 = evaluateShooter(b2.shooters[0]!, prog("RINGS_INT", stage(1), stage(1)));
    expect(ev2.errors).toEqual([]);
    expect(ev2.stages.map((x) => x.total)).toEqual([9, 10]);
  });

  it("Allgemein: Serientotale und Total", () => {
    const t = readScoreFile(enc(GENERIC_TOTALS));
    const b = buildShooters(t, suggestScoreMapping(t.headers, "generic"), "totals");
    expect(b.shooters.map((s) => s.name)).toEqual(["Hans Müller", "Keller Anna", "Beat Zürcher"]);
    const p = prog("RINGS_INT", stage(10), stage(10));
    const hans = evaluateShooter(b.shooters[0]!, p);
    expect(hans.stages).toEqual([{ stageIndex: 0, shots: null, total: 95 }, { stageIndex: 1, shots: null, total: 93 }]);
    expect(hans.total).toBe(188);
    expect(hans.warnings).toEqual([]);
    const anna = evaluateShooter(b.shooters[1]!, p);
    expect(anna.warnings).toContain("Serie 2: kein Total");
    const beat = evaluateShooter(b.shooters[2]!, p);
    expect(beat.warnings[0]).toMatch(/Total in der Datei 190, Summe der Serien 193/);
  });

  it("Totale prüfen: Maximum und Zehntel bei ganzen Ringen", () => {
    const t = readScoreFile(enc("Name;Serie 1\nA;101\nB;95.5"));
    const b = buildShooters(t, ["name", "seriesTotal"], "totals");
    expect(evaluateShooter(b.shooters[0]!, prog("RINGS_INT", stage(10))).errors[0]).toMatch(/über dem Maximum 100/);
    expect(evaluateShooter(b.shooters[1]!, prog("RINGS_INT", stage(10))).errors[0]).toMatch(/Zehntelwert/);
    expect(evaluateShooter(b.shooters[1]!, prog("RINGS_DECIMAL", stage(10))).errors).toEqual([]);
  });

  it("Nur Gesamttotal bei mehreren Serien", () => {
    const t = readScoreFile(enc("Name;Total\nA;150"));
    const b = buildShooters(t, ["name", "total"], "totals");
    const ev = evaluateShooter(b.shooters[0]!, prog("RINGS_INT", stage(10), stage(10)));
    expect(ev.stages).toEqual([{ stageIndex: 0, shots: null, total: 150 }]);
    expect(ev.warnings[0]).toMatch(/Gesamttotal/);
  });

  it("Zeile pro Serie (Serienspalte im Total-Aufbau)", () => {
    const t = readScoreFile(enc("Name;Serie;Total\nA;1;90\nA;2;91\nA;2;92"));
    const b = buildShooters(t, ["name", "series", "total"], "totals");
    expect(b.shooters[0]!.seriesTotals).toEqual([90, 92]);
    expect(b.shooters[0]!.errors[0]).toMatch(/Serie 2 kommt mehrfach vor/);
  });

  it("Mehrere Zeilen pro Schütze im Total-Aufbau = Fehler; Schusswert-Spalten", () => {
    const t = readScoreFile(enc("Name;S1;S2\nA;10;9\nA;8;7"));
    const m: ScoreField[] = ["name", "shotValue", "shotValue"];
    const b = buildShooters(t, m, "totals");
    expect(b.shooters[0]!.shots.map((s) => s.value)).toEqual([10, 9]);
    expect(b.shooters[0]!.errors[0]).toMatch(/Mehrere Zeilen/);
  });

  it("unlesbare Werte und fehlende Zuordnung", () => {
    const t = readScoreFile(enc("Name;Wert\nA;zehn\nA;9"));
    const b = buildShooters(t, ["name", "shotValue"], "shots");
    expect(b.shooters[0]!.errors[0]).toMatch(/Zeile 2: Schusswert «zehn» nicht lesbar/);
    expect(buildShooters(t, ["name", "ignore"], "shots").errors[0]).toMatch(/Schusswert/);
  });

  it("Notiz und Zuordnungs-Format", () => {
    expect(participantNote({ startNo: "12", club: "SG X" })).toBe("Startnr. 12 · SG X");
    expect(participantNote({ startNo: null, club: null })).toBeNull();
    expect(parseAssignment("m:abc123")).toEqual({ kind: "member", userId: "abc123" });
    expect(parseAssignment("guest")).toEqual({ kind: "guest" });
    expect(parseAssignment("m:")).toBeNull();
    expect(parseAssignment(1)).toBeNull();
    const d = duplicateAssignments([
      { key: "a", assignment: { kind: "member", userId: "u1" } },
      { key: "b", assignment: { kind: "member", userId: "u1" } },
      { key: "c", assignment: { kind: "guest" } },
    ]);
    expect([...d.keys()]).toEqual(["a", "b"]);
  });
});

describe("Namensabgleich", () => {
  const members = [
    { id: "u1", name: "Hans Müller" },
    { id: "u2", name: "Anna Keller" },
    { id: "u3", name: "Hans-Peter Meier" },
    { id: "u4", name: "Beat Zürcher" },
    { id: "u5", name: "Hans Mueller-Brunner" },
  ];

  it("foldName faltet Umlaute und Akzente", () => {
    expect(foldName("Müller")).toBe(foldName("Mueller"));
    expect(foldName("Zürcher")).toBe("zurcher");
    expect(foldName("Frédéric  Rösti")).toBe("frederic rosti");
  });

  it("Reihenfolge und Schreibweisen", () => {
    expect(nameSimilarity("Müller Hans", "Hans Müller")).toBe(1);
    expect(nameSimilarity("MUELLER, Hans", "Hans Müller")).toBe(1);
    expect(nameSimilarity("Hanspeter Meier", "Hans-Peter Meier")).toBeGreaterThan(0.92);
    expect(nameSimilarity("H. Müller", "Hans Müller")).toBeGreaterThan(0.85);
    expect(nameSimilarity("Keller", "Anna Keller")).toBeLessThan(0.92);
    expect(nameSimilarity("Peter Brunner", "Anna Keller")).toBeLessThan(0.6);
  });

  it("matchMember ordnet eindeutig zu", () => {
    expect(matchMember("Zuercher Beat", members).memberId).toBe("u4");
    expect(matchMember("Meier Hanspeter", members).memberId).toBe("u3");
    const unsure = matchMember("Kellr Ana", members);
    expect(unsure.memberId).toBeNull();
    expect(unsure.suggestions[0]?.id).toBe("u2");
    expect(matchMember("Fremder Gast", members).suggestions).toEqual([]);
  });

  it("matchAllMembers vergibt ein Mitglied nur einmal", () => {
    const r = matchAllMembers(["Hans Müller", "Müller Hans"], members);
    expect(r.filter((x) => x.memberId === "u1")).toHaveLength(1);
  });
});

describe("planImport", () => {
  it("zählt übernommene und blockierende Schützen", () => {
    const t = readScoreFile(enc(GENERIC_TOTALS));
    const config = { layout: "totals" as const, mapping: suggestScoreMapping(t.headers, "generic"), discipline: null };
    const p = prog("RINGS_INT", stage(10), stage(10));
    const plan = planImport(t, config, p, (s) => (s.name === "Beat Zürcher" ? { kind: "skip" } : { kind: "member", userId: s.name === "Hans Müller" ? "u1" : "u2" }), new Set(["u1"]));
    expect(plan.included).toBe(2);
    expect(plan.blocking).toBe(1);
    expect(plan.participants[1]!.errors).toContain("Mitglied nicht (mehr) im Verein");
    const noProgram = planImport(t, config, null, () => ({ kind: "guest" }));
    expect(noProgram.blocking).toBe(3);
  });
});
