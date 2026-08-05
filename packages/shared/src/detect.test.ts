import { describe, expect, it } from "vitest";
import { detectErrorTypeKey } from "./detect.js";

describe("detectErrorTypeKey", () => {
  it("erkennt ein fehlendes Komma", () => {
    expect(
      detectErrorTypeKey("Er kam wie immer zu spät.", "Er kam, wie immer, zu spät."),
    ).toBe("komma_fehlt");
  });

  it("erkennt ein überzähliges Komma", () => {
    expect(detectErrorTypeKey("Er kam, und ging.", "Er kam und ging.")).toBe("komma_zu_viel");
  });

  it("erkennt ein fehlendes Wort", () => {
    expect(detectErrorTypeKey("Er kam zu spät.", "Er kam viel zu spät.")).toBe("wort_fehlt");
  });

  it("erkennt ein überzähliges Wort", () => {
    expect(detectErrorTypeKey("Er kam sehr viel zu spät.", "Er kam viel zu spät.")).toBe(
      "wort_zu_viel",
    );
  });

  it("erkennt ein fehlendes Zeichen", () => {
    expect(detectErrorTypeKey("Er kam zu spät ins Bür.", "Er kam zu spät ins Büro.")).toBe(
      "zeichen_fehlt",
    );
  });

  it("erkennt ein überzähliges Zeichen", () => {
    expect(detectErrorTypeKey("Der Hundd bellt.", "Der Hund bellt.")).toBe("zeichen_zu_viel");
  });

  it("erkennt einen Buchstabendreher", () => {
    expect(detectErrorTypeKey("Das Huas ist alt.", "Das Haus ist alt.")).toBe("buchstabendreher");
  });

  it("erkennt eine falsche Zahl", () => {
    expect(detectErrorTypeKey("rund 4,2 Millionen Menschen", "rund 2,4 Millionen Menschen")).toBe(
      "falsche_zahl",
    );
  });

  it("erkennt ein falsches Jahr als Datum", () => {
    expect(detectErrorTypeKey("im Sommer 2024 begann", "im Sommer 2025 begann")).toBe(
      "falsches_datum",
    );
  });

  it("erkennt einen falschen Monat als Datum", () => {
    expect(detectErrorTypeKey("am 5. Januar erschien", "am 5. Februar erschien")).toBe(
      "falsches_datum",
    );
  });

  it("erkennt einen verwechselten Namen mitten im Satz", () => {
    expect(detectErrorTypeKey("sagte Kanzler Scholz am Montag", "sagte Kanzler Merz am Montag")).toBe(
      "falscher_name",
    );
  });

  it("nimmt am Satzanfang keinen Namen an", () => {
    expect(detectErrorTypeKey("Schnell kam er.", "Langsam kam er.")).toBe("falsche_wortwahl");
  });

  it("erkennt ein ersetztes Wort als Wortwahl", () => {
    expect(detectErrorTypeKey("Das Essen war köstlich.", "Das Essen war grauenhaft.")).toBe(
      "falsche_wortwahl",
    );
  });

  it("erkennt vertauschte Wortstellung als Satzbau", () => {
    expect(detectErrorTypeKey("gestern kam er an", "er kam gestern an")).toBe("satzbau");
  });

  it("schlägt bei vielen Änderungen nichts vor", () => {
    expect(
      detectErrorTypeKey("Der alte Hund bellt laut.", "Die junge Katze miaut leise dort."),
    ).toBeNull();
  });

  it("schlägt bei gleichen Texten nichts vor", () => {
    expect(detectErrorTypeKey("Alles richtig.", "Alles richtig.")).toBeNull();
    expect(detectErrorTypeKey("", "etwas")).toBeNull();
  });

  it("ignoriert Typografie-Unterschiede", () => {
    expect(detectErrorTypeKey("Er sagte „nein“ dazu.", 'Er sagte "nein" dazu.')).toBeNull();
  });
});
