import { describe, expect, it } from "vitest";
import { amountToCents, findAll, parseCamt, parseXml, textOf } from "./camt";

const CAMT053 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.04">
  <BkToCstmrStmt>
    <Stmt>
      <Acct><Id><IBAN>CH4431999123000889012</IBAN></Id></Acct>
      <!-- Gutschrift mit QR-Referenz -->
      <Ntry>
        <Amt Ccy="CHF">120.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts><Cd>BOOK</Cd></Sts>
        <BookgDt><Dt>2026-03-02</Dt></BookgDt>
        <AcctSvcrRef>BANK-1</AcctSvcrRef>
        <NtryDtls><TxDtls>
          <Refs><EndToEndId>E2E-1</EndToEndId></Refs>
          <Amt Ccy="CHF">120.00</Amt>
          <RltdPties><Dbtr><Nm>Muster &amp; Söhne</Nm></Dbtr></RltdPties>
          <RmtInf><Strd><CdtrRefInf><Ref>21 00000 00003 13947 14300 09017</Ref></CdtrRefInf><AddtlRmtInf>Beitrag 2026</AddtlRmtInf></Strd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
      <!-- Belastung: wird übersprungen -->
      <Ntry>
        <Amt Ccy="CHF">50.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>2026-03-03</Dt></BookgDt>
      </Ntry>
      <!-- Vorgemerkt (PDNG): wird übersprungen -->
      <Ntry>
        <Amt Ccy="CHF">10.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts>PDNG</Sts>
        <BookgDt><Dt>2026-03-04</Dt></BookgDt>
      </Ntry>
      <!-- Sammelgutschrift ohne Details, Datum mit Uhrzeit -->
      <Ntry>
        <Amt Ccy="CHF">1'234.5</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><DtTm>2026-03-05T10:15:00</DtTm></BookgDt>
        <AddtlNtryInf>Sammelbuchung</AddtlNtryInf>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

const CAMT054 = `<?xml version="1.0"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<n:Document xmlns:n="urn:iso:std:iso:20022:tech:xsd:camt.054.001.04">
  <n:BkToCstmrDbtCdtNtfctn>
    <n:Ntfctn>
      <n:Ntry>
        <n:Amt Ccy="CHF">75.00</n:Amt>
        <n:CdtDbtInd>CRDT</n:CdtDbtInd>
        <n:Sts>BOOK</n:Sts>
        <n:ValDt><n:Dt>2026-04-10</n:Dt></n:ValDt>
        <n:NtryDtls>
          <n:TxDtls>
            <n:AmtDtls><n:TxAmt><n:Amt Ccy="EUR">40.00</n:Amt></n:TxAmt></n:AmtDtls>
            <n:RmtInf><n:Ustrd>Reservation &xxe; Bahn 3</n:Ustrd></n:RmtInf>
          </n:TxDtls>
          <n:TxDtls>
            <n:Amt Ccy="CHF">35.00</n:Amt>
            <n:RltdPties><n:UltmtDbtr><n:Pty><n:Nm>Erika Beispiel</n:Nm></n:Pty></n:UltmtDbtr></n:RltdPties>
            <n:RmtInf><n:Strd><n:CdtrRefInf><n:Ref>rf18539007547034</n:Ref></n:CdtrRefInf></n:Strd></n:RmtInf>
          </n:TxDtls>
          <n:TxDtls>
            <n:CdtDbtInd>DBIT</n:CdtDbtInd>
            <n:Amt Ccy="CHF">5.00</n:Amt>
          </n:TxDtls>
        </n:NtryDtls>
      </n:Ntry>
      <n:Ntry>
        <n:Amt Ccy="CHF">20.00</n:Amt>
        <n:CdtDbtInd>CRDT</n:CdtDbtInd>
        <n:RvslInd>true</n:RvslInd>
        <n:BookgDt><n:Dt>2026-04-11</n:Dt></n:BookgDt>
      </n:Ntry>
    </n:Ntfctn>
  </n:BkToCstmrDbtCdtNtfctn>
</n:Document>`;

describe("amountToCents", () => {
  it("liest Beträge ohne Rundungsfehler", () => {
    expect(amountToCents("50")).toBe(5000);
    expect(amountToCents("50.5")).toBe(5050);
    expect(amountToCents("1'234.50")).toBe(123450);
    expect(amountToCents("0.10")).toBe(10);
    expect(amountToCents("19,99")).toBe(1999);
    expect(amountToCents("1.005")).toBe(101);
    expect(amountToCents("-3.20")).toBe(-320);
    expect(amountToCents("abc")).toBeNull();
    expect(amountToCents("")).toBeNull();
  });
});

describe("parseXml", () => {
  it("entfernt Namespaces, dekodiert Entities und toleriert CDATA", () => {
    const root = parseXml(`<a:x><a:y>1 &lt; 2</a:y><z><![CDATA[<roh>]]></z></a:x>`);
    expect(findAll(root, "y").map(textOf)).toEqual(["1 < 2"]);
    expect(textOf(findAll(root, "z")[0])).toBe("<roh>");
  });

  it("begrenzt die Verschachtelungstiefe", () => {
    expect(() => parseXml("<a>".repeat(100))).toThrow(/tief/);
  });
});

describe("parseCamt", () => {
  it("camt.053: Gutschriften, Belastungen und vorgemerkte Buchungen", () => {
    const r = parseCamt(CAMT053);
    expect(r.kind).toBe("camt.053");
    expect(r.iban).toBe("CH4431999123000889012");
    expect(r.skippedDebits).toBe(1);
    expect(r.skippedOther).toBe(1);
    expect(r.credits).toHaveLength(2);
    expect(r.credits[0]).toEqual({
      key: "0.0",
      amountCents: 12000,
      currency: "CHF",
      bookingDate: "2026-03-02",
      reference: "210000000003139471430009017",
      message: "Beitrag 2026",
      debtorName: "Muster & Söhne",
      bankRef: "E2E-1",
    });
    expect(r.credits[1]).toMatchObject({ key: "3", amountCents: 123450, bookingDate: "2026-03-05", reference: null, message: "Sammelbuchung", bankRef: null });
  });

  it("camt.054: mehrere Transaktionen, Fremdwährung, Storno und kein XXE", () => {
    const r = parseCamt(CAMT054);
    expect(r.kind).toBe("camt.054");
    expect(r.credits).toHaveLength(2);
    const [eur, scor] = r.credits;
    expect(eur).toMatchObject({ amountCents: 4000, currency: "EUR", bookingDate: "2026-04-10", reference: null });
    expect(eur!.message).toContain("Reservation");
    expect(eur!.message).not.toContain("root:");
    expect(scor).toMatchObject({ amountCents: 3500, currency: "CHF", reference: "RF18539007547034", debtorName: "Erika Beispiel" });
    expect(r.skippedDebits).toBe(1);
    expect(r.skippedOther).toBe(1); // Storno
  });

  it("meldet unbekannte und unlesbare Dateien verständlich", () => {
    expect(() => parseCamt("<Document><Foo/></Document>")).toThrow(/camt/);
    expect(() => parseCamt("< Document>")).toThrow(/kein lesbares XML/);
  });
});
