import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  decodeBytes,
  defaultDecision,
  detectDelimiter,
  detectPreset,
  findDuplicate,
  indexExisting,
  mapRows,
  nameKey,
  parseCsv,
  parseStatus,
  parseSwissDate,
  readCsvBytes,
  suggestMapping,
  type ImportField,
} from "./import";
import { isXlsx, readXlsxBytes } from "./xlsx";
import { ageOn, isMinor, parseMemberFilters, filtersToQuery, toDbDate } from "./types";

const TODAY = "2026-10-29";

describe("decodeBytes", () => {
  it("erkennt UTF-8 mit und ohne BOM", () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Zürich")]);
    expect(decodeBytes(withBom)).toEqual({ text: "Zürich", encoding: "utf-8" });
    expect(decodeBytes(new TextEncoder().encode("Müller"))).toEqual({ text: "Müller", encoding: "utf-8" });
  });

  it("fällt auf Windows-1252 zurück", () => {
    // «Zürich – €» in Windows-1252
    const bytes = new Uint8Array([0x5a, 0xfc, 0x72, 0x69, 0x63, 0x68, 0x20, 0x96, 0x20, 0x80]);
    expect(decodeBytes(bytes)).toEqual({ text: "Zürich – €", encoding: "windows-1252" });
  });

  it("liest UTF-16LE mit BOM", () => {
    const s = "Name\tOrt";
    const bytes = new Uint8Array(2 + s.length * 2);
    bytes[0] = 0xff;
    bytes[1] = 0xfe;
    for (let i = 0; i < s.length; i++) bytes[2 + i * 2] = s.charCodeAt(i);
    expect(decodeBytes(bytes).text).toBe(s);
  });
});

describe("CSV", () => {
  it("erkennt das Trennzeichen", () => {
    expect(detectDelimiter("Vorname;Nachname;Ort\nA;B;C")).toBe(";");
    expect(detectDelimiter("Vorname,Nachname,Ort\nA,B,C")).toBe(",");
    expect(detectDelimiter("Vorname\tNachname\nA\tB")).toBe("\t");
    // Kommas in Anführungszeichen zählen nicht
    expect(detectDelimiter('"Muster, Hans";Bern\n')).toBe(";");
    expect(detectDelimiter("\n\nName;Ort")).toBe(";");
  });

  it("parst Anführungszeichen, Escapes, Zeilenumbrüche und CRLF", () => {
    const text = 'Name;Bemerkung\r\n"Muster; Hans";"Er sagte ""Hallo""\nzweite Zeile"\r\nMeier;\r\n\r\n;;\r\n';
    expect(parseCsv(text, ";")).toEqual([
      ["Name", "Bemerkung"],
      ["Muster; Hans", 'Er sagte "Hallo"\nzweite Zeile'],
      ["Meier", ""],
    ]);
  });

  it("liest eine Datei mit Kopfzeile und füllt kurze Zeilen auf", () => {
    const t = readCsvBytes(new TextEncoder().encode("Vorname;Nachname;;\nHans;Muster\n"));
    expect(t.headers).toEqual(["Vorname", "Nachname", "Spalte 3", "Spalte 4"]);
    expect(t.rows).toEqual([["Hans", "Muster", "", ""]]);
    expect(t.delimiter).toBe(";");
  });

  it("lehnt leere Dateien und Dateien ohne Daten ab", () => {
    expect(() => readCsvBytes(new Uint8Array())).toThrow(/leer/);
    expect(() => readCsvBytes(new TextEncoder().encode("Name;Ort\n"))).toThrow(/keine Datenzeilen/);
  });

  it("begrenzt die Anzahl Zeilen", () => {
    const text = "Name\n" + Array.from({ length: 5001 }, (_, i) => `N${i}`).join("\n");
    expect(() => readCsvBytes(new TextEncoder().encode(text))).toThrow(/Zu viele Zeilen/);
  });
});

describe("Datum und Status", () => {
  it("parst Schweizer Datumsformate", () => {
    expect(parseSwissDate("31.12.1980")).toBe("1980-12-31");
    expect(parseSwissDate("1.2.2001")).toBe("2001-02-01");
    expect(parseSwissDate("01.02.85")).toBe("1985-02-01");
    expect(parseSwissDate("01.02.15")).toBe("2015-02-01");
    expect(parseSwissDate("1980-12-31")).toBe("1980-12-31");
    expect(parseSwissDate("31/12/1980")).toBe("1980-12-31");
    expect(parseSwissDate("31.12.1980 00:00")).toBe("1980-12-31");
    expect(parseSwissDate("29544")).toBe("1980-11-19"); // Excel-Seriennummer
    expect(parseSwissDate("31.02.2000")).toBeNull();
    expect(parseSwissDate("abc")).toBeNull();
    expect(parseSwissDate("")).toBeNull();
  });

  it("erkennt Status-Bezeichnungen", () => {
    expect(parseStatus("Aktivmitglied")).toBe("ACTIVE");
    expect(parseStatus("Passivmitglied")).toBe("PASSIVE");
    expect(parseStatus("Ehrenmitglied")).toBe("HONORARY");
    expect(parseStatus("Jungschütze")).toBe("JUNIOR");
    expect(parseStatus("Gönner")).toBe("SUPPORTER");
    expect(parseStatus("ausgetreten")).toBe("LEFT");
    expect(parseStatus("HONORARY")).toBe("HONORARY");
    expect(parseStatus("")).toBeNull();
    expect(parseStatus("Vorstand xy")).toBe("unknown");
  });
});

describe("Zuordnung", () => {
  it("ordnet Excel-Spalten zu, «Name» neben «Vorname» wird Nachname", () => {
    const headers = ["Vorname", "Name", "E-Mail", "Natel", "Strasse", "PLZ", "Ort", "Geburtsdatum", "Eintritt", "Mitgliedernummer", "Lizenz", "Status", "Kategorie", "Irgendwas"];
    expect(suggestMapping(headers, "excel")).toEqual([
      "firstName", "lastName", "email", "mobile", "street", "zip", "city", "birthDate", "joinedAt", "memberNumber", "licenseNumber", "status", "category", "ignore",
    ]);
  });

  it("vergibt jedes Feld nur einmal", () => {
    expect(suggestMapping(["E-Mail", "Email"], "excel")).toEqual(["email", "ignore"]);
  });

  it("nutzt Vorlagen", () => {
    const clubdesk = ["Nachname", "Vorname", "Adresse", "PLZ", "Ort", "Telefon Privat", "Telefon Geschäft", "Mobile", "E-Mail", "Geburtsdatum", "Eintritt", "Austritt", "Status"];
    expect(detectPreset(clubdesk)).toBe("clubdesk");
    expect(suggestMapping(clubdesk, "clubdesk")).toEqual([
      "lastName", "firstName", "street", "zip", "city", "phone", "ignore", "mobile", "email", "birthDate", "joinedAt", "leftAt", "status",
    ]);
    const webling = ["Name", "Vorname", "Strasse", "PLZ", "Ort", "E-Mail", "Geburtstag", "Mitgliederkategorie"];
    expect(detectPreset(webling)).toBe("webling");
    expect(suggestMapping(webling, "webling")).toEqual(["lastName", "firstName", "street", "zip", "city", "email", "birthDate", "status"]);
    expect(detectPreset(["Name", "Adresse"])).toBe("excel");
  });
});

describe("mapRows", () => {
  const mapping: ImportField[] = ["firstName", "lastName", "email", "phone", "mobile", "zipCity", "birthDate", "status", "leftAt"];

  it("übernimmt und prüft Zeilen", () => {
    const rows = [
      ["Hans", "Muster", "Hans@Example.ch", "", "079 123 45 67", "8000 Zürich", "31.12.1980", "Aktiv", ""],
      ["", "", "x@example.ch", "", "", "", "", "", ""],
      ["Eva", "Meier", "hans@example.ch", "044 111 22 33", "", "Bern", "1.1.2099", "Präsident", ""],
      ["Ueli", "Alt", "kein-mail", "", "", "", "kaputt", "", "01.01.2020"],
    ];
    const [a, b, c, d] = mapRows(rows, mapping, TODAY);
    expect(a!.record).toMatchObject({ name: "Hans Muster", email: "hans@example.ch", phone: "079 123 45 67", zip: "8000", city: "Zürich", birthDate: "1980-12-31", status: "ACTIVE" });
    expect(a!.errors).toEqual([]);
    expect(a!.line).toBe(2);
    expect(b!.errors).toContain("Name fehlt");
    expect(c!.errors[0]).toMatch(/doppelt.*Zeile 2/);
    expect(c!.record.phone).toBe("044 111 22 33");
    expect(c!.record.city).toBe("Bern");
    expect(c!.record.birthDate).toBeNull();
    expect(c!.record.status).toBe("ACTIVE");
    expect(c!.warnings.join(" ")).toMatch(/unplausibel/);
    expect(c!.warnings.join(" ")).toMatch(/Präsident/);
    expect(d!.record.email).toBeNull();
    expect(d!.record.status).toBe("LEFT");
    expect(d!.record.leftAt).toBe("2020-01-01");
    expect(d!.warnings.length).toBe(2);
  });

  it("nimmt den vollen Namen, wenn Vor-/Nachname fehlen, und kürzt zu lange Werte", () => {
    const [r] = mapRows([["Hans Muster", "x".repeat(300)]], ["name", "street"], TODAY);
    expect(r!.record.name).toBe("Hans Muster");
    expect(r!.record.street!.length).toBe(191);
    expect(r!.warnings.join(" ")).toMatch(/gekürzt/);
  });
});

describe("Dubletten", () => {
  const existing = indexExisting([
    { membershipId: "m1", userId: "u1", name: "Hans Muster", email: "hans@example.ch", birthDate: "1980-12-31" },
    { membershipId: "m2", userId: "u2", name: "Eva Müller", email: "noemail+x@standchef.invalid", birthDate: "1990-05-01" },
  ]);
  const rec = (name: string, email: string | null, birthDate: string | null) => mapRows([[name, email ?? "", birthDate ?? ""]], ["name", "email", "birthDate"], TODAY)[0]!;

  it("findet gleiche E-Mail oder Name + Geburtsdatum", () => {
    expect(findDuplicate(rec("Irgendwer", "hans@example.ch", null).record, existing)).toMatchObject({ membershipId: "m1", reason: "email" });
    expect(findDuplicate(rec("Müller Eva", null, "01.05.1990").record, existing)).toMatchObject({ membershipId: "m2", reason: "nameBirth" });
    expect(findDuplicate(rec("Eva Müller", null, "02.05.1990").record, existing)).toBeNull();
  });

  it("erkennt erneut importierte Zeilen ohne E-Mail und Geburtsdatum (Mitgliedernummer, sonst Name)", () => {
    const idx = indexExisting([
      { membershipId: "m3", userId: "u3", name: "Hans Gröbli", email: "noemail+a@standchef.invalid", birthDate: null, memberNumber: "M244753" },
      { membershipId: "m4", userId: "u4", name: "Otto Ohnemail", email: "noemail+b@standchef.invalid", birthDate: null, memberNumber: null },
      { membershipId: "m5", userId: "u5", name: "Peter Andere", email: "noemail+c@standchef.invalid", birthDate: null, memberNumber: "A1" },
    ]);
    const row = (name: string, email: string, birth: string, nr: string) => mapRows([[name, email, birth, nr]], ["name", "email", "birthDate", "memberNumber"], TODAY)[0]!;
    // ungültige E-Mail und ungültiges Datum fallen weg – die Mitgliedernummer trifft trotzdem
    const a = row("Hans Gröbli", "not-an-email", "31.02.1990", " m244753 ");
    expect(findDuplicate(a.record, idx)).toMatchObject({ membershipId: "m3", reason: "memberNumber" });
    expect(defaultDecision(a, findDuplicate(a.record, idx))).toBe("update");
    const b = row("Ohnemail Otto", "", "", "M244756");
    expect(findDuplicate(b.record, idx)).toMatchObject({ membershipId: "m4", reason: "name" });
    expect(defaultDecision(b, findDuplicate(b.record, idx))).toBe("skip");
    // gleicher Name, aber andere Mitgliedernummer: andere Person
    expect(findDuplicate(row("Peter Andere", "", "", "A2").record, idx)).toBeNull();
    // mit Geburtsdatum kein unsicherer Namensabgleich
    expect(findDuplicate(row("Otto Ohnemail", "", "01.01.1970", "").record, idx)).toBeNull();
  });

  it("erkennt dieselbe Person mehrfach in einer Datei", () => {
    const [a, b, c, d] = mapRows([
      ["Hans Gröbli", "M1"],
      ["Gröbli Hans", "m1"],
      ["Otto Ohnemail", ""],
      ["Otto Ohnemail", ""],
    ], ["name", "memberNumber"], TODAY);
    expect(a!.errors).toEqual([]);
    expect(b!.errors[0]).toMatch(/Mitgliedernummer doppelt.*Zeile 2/);
    expect(c!.warnings).toEqual([]);
    expect(d!.warnings.join(" ")).toMatch(/Gleicher Name wie Zeile 4/);
  });

  it("schlägt eine Aktion vor", () => {
    const ok = rec("Neu Person", "neu@example.ch", null);
    expect(defaultDecision(ok, null)).toBe("create");
    expect(defaultDecision(ok, { membershipId: "m1", userId: "u1", name: "x", reason: "email" })).toBe("update");
    expect(defaultDecision(rec("", null, null), null)).toBe("skip");
  });

  it("vergleicht Namen ohne Akzente und Reihenfolge", () => {
    expect(nameKey("Müller  Eva")).toBe(nameKey("eva MÜLLER"));
  });
});

describe("Excel (.xlsx)", () => {
  it("liest das erste Blatt mit geteilten Zeichenketten und Zahlen", () => {
    const xlsx = zipSync({
      "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="Mitglieder" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
      "xl/sharedStrings.xml": strToU8("<sst><si><t>Vorname</t></si><si><t>Nachname</t></si><si><t>Geburtsdatum</t></si><si><t>Hans</t></si><si><r><t>Mus</t></r><r><t>ter &amp; Co</t></r></si></sst>"),
      "xl/worksheets/sheet1.xml": strToU8(
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
          '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2"><v>29544</v></c></row>' +
          '<row r="4"><c r="A4" t="inlineStr"><is><t>Eva</t></is></c><c r="C4"><v>1</v></c></row></sheetData></worksheet>',
      ),
    });
    expect(isXlsx(xlsx)).toBe(true);
    const t = readXlsxBytes(xlsx);
    expect(t.headers).toEqual(["Vorname", "Nachname", "Geburtsdatum"]);
    expect(t.rows).toEqual([
      ["Hans", "Muster & Co", "29544"],
      ["Eva", "", "1"],
    ]);
    const [r] = mapRows(t.rows, suggestMapping(t.headers, "excel"), TODAY);
    expect(r!.record.birthDate).toBe("1980-11-19");
  });
});

describe("Hilfsfunktionen", () => {
  it("berechnet Alter und Minderjährigkeit", () => {
    expect(ageOn("2008-10-30", TODAY)).toBe(17);
    expect(ageOn("2008-10-29", TODAY)).toBe(18);
    expect(isMinor("2008-10-30", TODAY)).toBe(true);
    expect(isMinor("2008-10-29", TODAY)).toBe(false);
    expect(isMinor(null, TODAY)).toBe(false);
  });

  it("prüft Datumswerte für die Datenbank", () => {
    expect(toDbDate("2020-02-29")?.toISOString()).toBe("2020-02-29T00:00:00.000Z");
    expect(toDbDate("2021-02-29")).toBeNull();
    expect(toDbDate("")).toBeNull();
  });

  it("liest und schreibt Listenfilter", () => {
    const f = parseMemberFilters({ q: " Muster ", status: "ACTIVE", sort: "bogus", page: "3", minor: "1" });
    expect(f).toMatchObject({ q: "Muster", status: "ACTIVE", sort: "name", page: 3, minor: true });
    expect(filtersToQuery({ ...f, page: 1 })).toBe("?q=Muster&status=ACTIVE&minor=1");
  });
});
