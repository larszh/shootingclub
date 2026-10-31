import { describe, expect, it } from "vitest";
import {
  addMonthsDay,
  ageOn,
  attendanceSummary,
  attendanceIndex,
  canComplete,
  completionMatrix,
  evaluatePass,
  evaluateRule,
  grantNote,
  guardianProblem,
  isMinorOn,
  mapImportRows,
  ndsAttendanceRows,
  parseIdCsv,
  participantKey,
  qualificationValidity,
  splitGrantNote,
  splitName,
  toIdCsv,
} from "./logic";
import { isProtectedQualKind, monthsLabel } from "./types";

describe("ageOn / isMinorOn", () => {
  it("rechnet ganze Jahre bis zum Stichtag", () => {
    expect(ageOn("2008-05-10", "2026-05-09")).toBe(17);
    expect(ageOn("2008-05-10", "2026-05-10")).toBe(18);
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageOn("2008-02-29", "2026-03-01")).toBe(18);
    expect(ageOn(null, "2026-01-01")).toBeNull();
  });
  it("minderjährig nur mit bekanntem Geburtsdatum", () => {
    expect(isMinorOn("2010-01-01", "2026-06-01")).toBe(true);
    expect(isMinorOn("2000-01-01", "2026-06-01")).toBe(false);
    expect(isMinorOn(null, "2026-06-01")).toBe(false);
  });
});

describe("addMonthsDay / qualificationValidity", () => {
  it("begrenzt auf das Monatsende", () => {
    expect(addMonthsDay("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsDay("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsDay("2026-11-15", 12)).toBe("2027-11-15");
    expect(addMonthsDay("2026-11-15", 3)).toBe("2027-02-15");
  });
  it("Gültigkeit ab Schiesstag", () => {
    expect(qualificationValidity("2026-10-29", 12)).toEqual({ validFrom: "2026-10-29", validUntil: "2027-10-29" });
  });
});

describe("parseIdCsv / toIdCsv", () => {
  it("entfernt Leerstellen und Doppelte", () => {
    expect(parseIdCsv(" a, b,,a ,c")).toEqual(["a", "b", "c"]);
    expect(parseIdCsv(null)).toEqual([]);
    expect(toIdCsv(["x", "y", "x"])).toBe("x,y");
    expect(toIdCsv([])).toBeNull();
  });
});

describe("evaluatePass", () => {
  it("ohne Grenzen nicht beurteilbar", () => {
    expect(evaluatePass({ minScore: null, maxZeros: null }, 50, 0)).toBeNull();
  });
  it("prüft Punkte und Nuller", () => {
    expect(evaluatePass({ minScore: 42, maxZeros: 3 }, 42, 3)).toBe(true);
    expect(evaluatePass({ minScore: 42, maxZeros: 3 }, 41, 0)).toBe(false);
    expect(evaluatePass({ minScore: 42, maxZeros: 3 }, 50, 4)).toBe(false);
    expect(evaluatePass({ minScore: 42, maxZeros: 3 }, 50, null)).toBe(false);
    expect(evaluatePass({ minScore: 42, maxZeros: null }, null, null)).toBe(false);
  });
});

describe("completionMatrix", () => {
  const results = [
    { participantId: "p1", programId: "A", passed: false, score: 30, date: "2026-05-01" },
    { participantId: "p1", programId: "A", passed: true, score: 45, date: "2026-06-01" },
    { participantId: "p1", programId: "B", passed: true, score: 80, date: "2026-06-02" },
    { participantId: "p2", programId: "A", passed: false, score: 20, date: "2026-05-01" },
    { participantId: "p2", programId: "X", passed: true, score: 99, date: "2026-05-01" },
  ];
  const m = completionMatrix(["p1", "p2", "p3"], ["A", "B"], results);
  it("markiert bestanden, nicht bestanden und offen", () => {
    expect(m[0]!.cells.A!.state).toBe("passed");
    expect(m[0]!.cells.A!.best!.score).toBe(45);
    expect(m[0]!.cells.A!.attempts).toBe(2);
    expect(m[0]!.allPassed).toBe(true);
    expect(m[1]!.cells.A!.state).toBe("failed");
    expect(m[1]!.cells.B!.state).toBe("open");
    expect(m[1]!.passedCount).toBe(0);
    expect(m[2]!.allPassed).toBe(false);
  });
  it("ohne Pflichtprogramme ist alles erfüllt", () => {
    expect(completionMatrix(["p1"], [], results)[0]!.allPassed).toBe(true);
  });
  it("Abschluss nur bei allen bestanden und aktivem Status", () => {
    expect(canComplete(m[0]!, "ACTIVE")).toBe(true);
    expect(canComplete(m[0]!, "DROPPED")).toBe(false);
    expect(canComplete(m[0]!, "COMPLETED")).toBe(false);
    expect(canComplete(m[1]!, "ACTIVE")).toBe(false);
  });
});

describe("evaluateRule", () => {
  it("erfüllt bei genügend Punkten und wenig Nullern", () => {
    expect(evaluateRule({ passScore: 160, maxZeros: 2 }, { total: 160, zeros: 2 })).toEqual({ ok: true, reasons: [] });
  });
  it("nennt Gründe", () => {
    const r = evaluateRule({ passScore: 160, maxZeros: 2 }, { total: 150.5, zeros: 3 });
    expect(r.ok).toBe(false);
    expect(r.reasons).toHaveLength(2);
    expect(r.reasons[0]).toContain("150.5");
    expect(evaluateRule({ passScore: 10, maxZeros: null }, { total: null, zeros: null }).ok).toBe(false);
    expect(evaluateRule({ passScore: 10, maxZeros: null }, { total: 12, zeros: null }).ok).toBe(true);
  });
});

describe("Präsenz / NDS", () => {
  const participants = [
    { id: "p1", firstName: "Lea", lastName: "Zürcher", birthDay: "2009-03-04" },
    { id: "p2", firstName: "Max", lastName: "Amsler", birthDay: null },
  ];
  const sessions = [
    { id: "s2", day: "2026-05-09" },
    { id: "s1", day: "2026-05-02" },
    { id: "s3", day: "2026-05-09" },
  ];
  const att = [
    { sessionId: "s1", participantId: "p1", present: true },
    { sessionId: "s2", participantId: "p1", present: false },
    { sessionId: "s1", participantId: "p2", present: true },
    { sessionId: "s3", participantId: "p2", present: true },
  ];
  it("baut die Tabelle mit 1/0 pro Lektion", () => {
    const rows = ndsAttendanceRows(participants, sessions, att);
    expect(rows[0]).toEqual(["Name", "Vorname", "Geburtsdatum", "02.05.2026", "09.05.2026", "09.05.2026 (2)"]);
    expect(rows[1]).toEqual(["Amsler", "Max", "", "1", "0", "1"]);
    expect(rows[2]).toEqual(["Zürcher", "Lea", "04.03.2009", "1", "0", "0"]);
  });
  it("zählt Anwesenheiten", () => {
    expect(attendanceSummary("p1", ["s1", "s2", "s3"], attendanceIndex(att))).toEqual({ present: 1, recorded: 2, total: 3 });
  });
});

describe("Import", () => {
  const headers = ["Vorname", "Nachname", "Geburtsdatum", "E-Mail", "Telefon", "Erziehungsberechtigte", "E-Mail Erziehungsberechtigte", "Telefon Erziehungsberechtigte"];
  it("liest Zeilen und prüft Minderjährige", () => {
    const rows = [
      ["Lea", "Muster", "04.03.2010", "lea@example.ch", "", "Eva Muster", "eva@example.ch", ""],
      ["Tim", "Kurz", "01.01.2011", "", "", "", "", ""],
      ["", "", "", "", "", "", "", ""],
      ["Ana", "Alt", "1990-01-01", "nope", "", "", "", ""],
    ];
    const out = mapImportRows(headers, rows, "2026-05-01", "2026-10-29");
    expect(out).toHaveLength(3);
    expect(out[0]!.errors).toEqual([]);
    expect(out[0]!.birthDate).toBe("2010-03-04");
    expect(out[0]!.guardianEmail).toBe("eva@example.ch");
    expect(out[1]!.errors[0]).toContain("Erziehungsberechtigte");
    expect(out[2]!.line).toBe(5);
    expect(out[2]!.errors[0]).toContain("E-Mail");
  });
  it("ordnet vertauschte Spalten über die Kopfzeile zu", () => {
    const out = mapImportRows(["Nachname", "Vorname", "E-Mail Erziehungsberechtigte", "E-Mail"], [["Muster", "Lea", "eva@example.ch", "lea@example.ch"]], "2026-01-01", "2026-01-01");
    expect(out[0]!.firstName).toBe("Lea");
    expect(out[0]!.email).toBe("lea@example.ch");
    expect(out[0]!.guardianEmail).toBe("eva@example.ch");
  });
});

describe("Hilfen", () => {
  it("splitName / participantKey", () => {
    expect(splitName("Anna Maria Muster")).toEqual({ firstName: "Anna Maria", lastName: "Muster" });
    expect(participantKey({ firstName: " Léa", lastName: "MUSTER", birthDate: null })).toBe("lea|muster|");
  });
  it("guardianProblem", () => {
    expect(guardianProblem({ birthDate: "2015-01-01", guardianName: null, guardianEmail: null, guardianPhone: null }, "2026-01-01")).toContain("Unter 18");
    expect(guardianProblem({ birthDate: "2015-01-01", guardianName: "Eva", guardianEmail: null, guardianPhone: "079" }, "2026-01-01")).toBeNull();
    expect(guardianProblem({ birthDate: "1990-01-01", guardianName: null, guardianEmail: null, guardianPhone: null }, "2026-01-01")).toBeNull();
  });
});

describe("grantNote / splitGrantNote", () => {
  it("speichert die Anforderung zum Zeitpunkt der Erteilung", () => {
    const note = grantNote({ total: 126, zeros: 0 }, { passScore: 60, maxZeros: 2 });
    expect(splitGrantNote(note)).toEqual({ note: "126 Pkt., 0 Nuller", requirement: "mindestens 60 Punkte, höchstens 2 Nuller" });
  });
  it("ältere Bemerkungen ohne Anforderung bleiben unverändert", () => {
    expect(splitGrantNote("126 Pkt., 0 Nuller")).toEqual({ note: "126 Pkt., 0 Nuller", requirement: null });
    expect(splitGrantNote(null)).toEqual({ note: null, requirement: null });
  });
});

describe("isProtectedQualKind / monthsLabel", () => {
  it("Sicherheits- und Leiterqualifikationen sind geschützt", () => {
    expect(isProtectedQualKind("SCHUETZENMEISTER")).toBe(true);
    expect(isProtectedQualKind("RANGE_OFFICER")).toBe(true);
    expect(isProtectedQualKind("JS_LEITER")).toBe(true);
    expect(isProtectedQualKind("WEAPON_QUAL")).toBe(false);
    expect(isProtectedQualKind("OTHER")).toBe(false);
  });
  it("Einzahl und Mehrzahl", () => {
    expect(monthsLabel(1)).toBe("1 Monat");
    expect(monthsLabel(12)).toBe("12 Monate");
  });
});
