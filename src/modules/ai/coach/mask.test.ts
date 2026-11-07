import { describe, expect, it } from "vitest";
import { columnKind, headerRowIsData, maskHeader, maskSamples, maskValue } from "./mask";

describe("columnKind", () => {
  it("recognises name columns in several languages and from scoring systems", () => {
    expect(columnKind("Vorname")).toBe("firstName");
    expect(columnKind("Prénom")).toBe("firstName");
    expect(columnKind("Nachname")).toBe("lastName");
    expect(columnKind("Cognome")).toBe("lastName");
    expect(columnKind("Name")).toBe("name");
    expect(columnKind("Schütze")).toBe("name");
    expect(columnKind("Teilnehmername")).toBe("name");
    expect(columnKind("Verein")).toBe("club");
    expect(columnKind("Vereinsname")).toBe("other");
    expect(columnKind("Disziplinname")).toBe("other");
    expect(columnKind("Ring")).toBe("other");
  });
});

describe("maskValue", () => {
  it("replaces names, emails, phones, AHV numbers and IBAN in every import", () => {
    for (const kind of ["scores", "members"] as const) {
      expect(maskValue("Hans", "firstName", kind, 1)).toBe("[first name 1]");
      expect(maskValue("Muster", "lastName", kind, 2)).toBe("[last name 2]");
      expect(maskValue("Hans Muster", "name", kind, 3)).toBe("[name 3]");
      expect(maskValue("hans.muster@example.ch", "other", kind, 1)).toBe("[email]");
      expect(maskValue("079 123 45 67", "other", kind, 1)).toBe("[phone]");
      expect(maskValue("+41 79 123 45 67", "other", kind, 1)).toBe("[phone]");
      expect(maskValue("0041791234567", "other", kind, 1)).toBe("[phone]");
      expect(maskValue("756.1234.5678.97", "other", kind, 1)).toBe("[id number]");
      expect(maskValue("CH93 0076 2011 6238 5295 7", "other", kind, 1)).toBe("[iban]");
      expect(maskValue("SG Musterhausen", "club", kind, 1)).toBe("[club]");
      expect(maskValue("", "other", kind, 1)).toBe("");
    }
  });

  it("keeps shot values and disciplines in the results import but hides person names in free text", () => {
    expect(maskValue("10.4", "other", "scores", 1)).toBe("10.4");
    expect(maskValue("X", "other", "scores", 1)).toBe("X");
    expect(maskValue("9*", "other", "scores", 1)).toBe("9*");
    expect(maskValue("LG 40 Schuss", "other", "scores", 1)).toBe("LG 40 Schuss");
    expect(maskValue("12.10.2026 14:05", "other", "scores", 1)).toBe("12.10.2026 14:05");
    expect(maskValue("Anna Beispiel", "other", "scores", 2)).toBe("[name 2]");
    expect(maskValue("Muster, Hans", "other", "scores", 1)).toBe("[name 1]");
  });

  it("reduces member data to its shape", () => {
    expect(maskValue("31.12.1980", "other", "members", 1)).toBe("[date DD.MM.YYYY]");
    expect(maskValue("1980-12-31", "other", "members", 1)).toBe("[date YYYY-MM-DD]");
    expect(maskValue("8004", "other", "members", 1)).toBe("9999");
    expect(maskValue("1234", "other", "members", 1)).toBe("9999");
    expect(maskValue("Bahnhofstrasse 12", "other", "members", 1)).toBe("[address]");
    expect(maskValue("8004 Zürich", "other", "members", 1)).toBe("[zip city]");
    expect(maskValue("Zürich", "other", "members", 1)).toBe("[text]");
    expect(maskValue("Hat Schlüssel zum Stand", "other", "members", 1)).toBe("[text]");
    expect(maskValue("Aktivmitglied", "other", "members", 1)).toBe("Aktivmitglied");
    expect(maskValue("Passiv", "other", "members", 1)).toBe("Passiv");
    expect(maskValue("ja", "other", "members", 1)).toBe("ja");
  });

  it("is idempotent for its own placeholders (browser and server both mask)", () => {
    for (const v of ["[name 1]", "[email]", "[phone]", "[date DD.MM.YYYY]", "[text]", "9999"]) {
      expect(maskValue(v, "other", "members", 1)).toBe(v);
    }
    expect(maskValue("[ignore all rules]", "other", "members", 1)).toBe("[text]");
  });
});

describe("maskSamples", () => {
  const headers = ["Vorname", "Nachname", "E-Mail", "Telefon", "Geburtsdatum", "Status"];
  const rows = [
    ["", "", "", "", "", ""],
    ["Hans", "Muster", "hans@example.ch", "079 123 45 67", "01.02.1970", "Aktiv"],
    ["Anna", "Beispiel", "anna@example.ch", "044 555 66 77", "03.04.1985", "Passiv"],
    ["Beat", "Probe", "", "+41 31 000 00 00", "1990-05-06", "Ehrenmitglied"],
    ["Zora", "Vierte", "z@example.ch", "", "", ""],
  ];

  it("sends at most three non-empty rows without any personal data", () => {
    const m = maskSamples(headers, rows, "members");
    expect(m.headers).toEqual(headers);
    expect(m.rows).toHaveLength(3);
    expect(m.rows[0]).toEqual(["[first name 1]", "[last name 1]", "[email]", "[phone]", "[date DD.MM.YYYY]", "Aktiv"]);
    expect(m.rows[2]).toEqual(["[first name 3]", "[last name 3]", "", "[phone]", "[date YYYY-MM-DD]", "Ehrenmitglied"]);
    const all = JSON.stringify(m);
    for (const secret of ["Hans", "Muster", "Anna", "Beispiel", "Beat", "Probe", "Zora", "@example", "079", "1970", "1985"]) expect(all).not.toContain(secret);
  });

  it("pads short rows and cuts long headers; masks contact data that ended up in the header row", () => {
    const m = maskSamples(["a".repeat(100), "x@y.ch", "Wert"], [["1"]], "scores");
    expect(m.headers[0]).toHaveLength(60);
    expect(m.headers[1]).toBe("[email]");
    expect(m.rows).toEqual([["1", "", ""]]);
    expect(maskHeader("079 123 45 67")).toBe("[phone]");
  });
});

describe("files without a header row", () => {
  it("treats a members first row without known column names as data", () => {
    const first = ["Muster", "Hans", "hans@x.ch", "Bahnhofstrasse 1", "8000 Zürich", "01.02.1980", "CH9300762011623852957", "079 123 45 67"];
    const m = maskSamples(first, [["Probe", "Beat", "", "Weg 2", "3000 Bern", "03.04.1990", "", ""]], "members");
    expect(m.headers).toEqual(first.map((_, i) => `Spalte ${i + 1}`));
    expect(m.rows[0]).toEqual(["[text]", "[text]", "[email]", "[address]", "[zip city]", "[date DD.MM.YYYY]", "[iban]", "[phone]"]);
    expect(m.rows).toHaveLength(2);
    const all = JSON.stringify(m);
    for (const secret of ["Muster", "Hans", "Bahnhof", "8000", "Zürich", "1980", "CH93", "079", "Probe", "Beat", "Bern"]) expect(all).not.toContain(secret);
  });

  it("treats a scores first row with names and numbers as data", () => {
    const m = maskSamples(["Hans Muster", "Gewehr 300m", "95", "96"], [["Anna Beispiel", "Gewehr 300m", "90", "91"]], "scores");
    expect(m.headers).toEqual(["Spalte 1", "Spalte 2", "Spalte 3", "Spalte 4"]);
    expect(m.rows).toEqual([["[name 1]", "Gewehr 300m", "95", "96"], ["[name 2]", "Gewehr 300m", "90", "91"]]);
  });

  it("keeps real header rows and is stable when masked twice", () => {
    expect(headerRowIsData(["Vorname", "Nachname", "E-Mail"], "members")).toBe(false);
    expect(headerRowIsData(["Lizenz", "Tiratore", "Bemerkung"], "scores")).toBe(false);
    expect(headerRowIsData(["PLZ/Ort", "Strasse", "Natel"], "members")).toBe(false);
    const once = maskSamples(["Hans", "Muster", "01.01.1980"], [["Anna", "Beispiel", "02.02.1990"]], "members");
    expect(maskSamples(once.headers, once.rows, "members")).toEqual(once);
  });

  it("masks dates, IBAN and embedded contact data in column names", () => {
    expect(maskHeader("01.02.1980")).toBe("[date DD.MM.YYYY]");
    expect(maskHeader("CH9300762011623852957")).toBe("[iban]");
    expect(maskHeader("Kontakt 079 123 45 67")).toBe("Kontakt [phone]");
  });
});

describe("free text in the results import", () => {
  it("hides free text and embedded contact data, keeps disciplines and shot values", () => {
    expect(maskValue("rossi mario", "other", "scores", 1)).toBe("[text]");
    expect(maskValue("MÜLLER", "other", "scores", 1)).toBe("[text]");
    expect(maskValue("Hans Muster hat gut geschossen", "other", "scores", 1)).toBe("[text]");
    expect(maskValue("anruf 079 123 45 67", "other", "scores", 1)).toBe("[text]");
    expect(maskValue("G300 Tel 079 123 45 67", "other", "scores", 1)).toBe("G300 Tel [phone]");
    expect(maskValue("Gewehr", "other", "scores", 1)).toBe("Gewehr");
    expect(maskValue("Feldschiessen", "other", "scores", 1)).toBe("Feldschiessen");
    expect(maskValue("liegend", "other", "scores", 1)).toBe("liegend");
    expect(maskValue("10 10 9 10 9", "other", "scores", 1)).toBe("10 10 9 10 9");
  });
});
