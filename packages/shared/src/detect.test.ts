import { describe, expect, it } from "vitest";
import { detectErrorChar, detectErrorCount, detectErrorTypeKey, detectSeverity } from "./detect.js";

describe("detectErrorTypeKey", () => {
  it("erkennt ein fehlendes Leerzeichen (Zusammenschreibung)", () => {
    expect(
      detectErrorTypeKey("Kann die Bahn ihn wiederbeleben?", "Kann die Bahn ihn wieder beleben?"),
    ).toBe("leerzeichen_fehlt");
  });

  it("erkennt ein ueberzaehliges Leerzeichen (Getrenntschreibung)", () => {
    expect(detectErrorTypeKey("so wohl die einen", "sowohl die einen")).toBe(
      "leerzeichen_zu_viel",
    );
  });

  it("zaehlt fehlende Leerzeichen mit", () => {
    expect(
      detectErrorCount("erzog los", "er zog los", detectErrorTypeKey("erzog los", "er zog los")),
    ).toBe(1);
  });

  it("gibt bei nur verschobenem Leerzeichen keinen Schluessel", () => {
    expect(detectErrorTypeKey("wie derbeleben", "wieder beleben")).toBe(null);
  });

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

  it("zählt mehrere fehlende Zeichen in dieselbe Kategorie", () => {
    expect(detectErrorTypeKey("Das Hs ist alt.", "Das Haus ist alt.")).toBe("zeichen_fehlt");
  });

  it("zählt mehrere überzählige Zeichen in dieselbe Kategorie", () => {
    expect(detectErrorTypeKey("Das Haauss ist alt.", "Das Haus ist alt.")).toBe("zeichen_zu_viel");
  });

  it("deutet ein fast völlig anderes Wort nicht als Zeichenfehler", () => {
    expect(detectErrorTypeKey("Dann er es.", "Dann erklärte er es.")).not.toBe("zeichen_fehlt");
  });

  it("erkennt mehrere fehlende Wörter", () => {
    expect(detectErrorTypeKey("Er kam an.", "Er kam gestern Abend an.")).toBe("wort_fehlt");
  });

  it("erkennt mehrere überzählige Wörter", () => {
    expect(detectErrorTypeKey("Er kam gestern Abend an.", "Er kam an.")).toBe("wort_zu_viel");
  });

  it("zählt mehrere fehlende Satzzeichen zusammen", () => {
    expect(detectErrorTypeKey("Er kam sah und siegte", "Er kam, sah und siegte!")).toBe(
      "komma_fehlt",
    );
  });

  it("zählt mehrere überzählige Satzzeichen zusammen", () => {
    expect(detectErrorTypeKey("Er kam, sah, und siegte!!", "Er kam, sah und siegte!")).toBe(
      "komma_zu_viel",
    );
  });

  it("zaehlt die Einheiten zur erkannten Kategorie", () => {
    expect(detectErrorCount("Das Hs ist alt.", "Das Haus ist alt.", "zeichen_fehlt")).toBe(2);
    expect(detectErrorCount("Der Hundd bellt.", "Der Hund bellt.", "zeichen_zu_viel")).toBe(1);
    expect(detectErrorCount("Er kam sah und siegte", "Er kam, sah und siegte!", "komma_fehlt")).toBe(2);
    expect(detectErrorCount("Er kam an.", "Er kam gestern Abend an.", "wort_fehlt")).toBe(2);
    expect(detectErrorCount("Er kam gestern Abend an.", "Er kam an.", "wort_zu_viel")).toBe(2);
    expect(detectErrorCount("Das Huas ist alt.", "Das Haus ist alt.", "buchstabendreher")).toBe(1);
    expect(detectErrorCount("a", "b", "falsche_wortwahl")).toBeNull();
    expect(detectErrorCount("a", "b", null)).toBeNull();
  });

  it("bestimmt bei Satzzeichen-Fehlern das konkrete Zeichen", () => {
    expect(detectErrorChar("Er kam, und ging.", "Er kam und ging.", "komma_zu_viel")).toBe(",");
    expect(detectErrorChar("Er kam an", "Er kam an.", "komma_fehlt")).toBe(".");
    expect(detectErrorChar("Er kam sah und siegte", "Er kam, sah und siegte!", "komma_fehlt")).toBeNull();
    expect(detectErrorChar("a,b", "ab", "zeichen_zu_viel")).toBeNull();
  });

  it("erkennt einen Buchstabendreher", () => {
    expect(detectErrorTypeKey("Das Huas ist alt.", "Das Haus ist alt.")).toBe("buchstabendreher");
  });

  it("deutet ein einzelnes getauschtes Zeichen als Buchstabendreher", () => {
    expect(detectErrorTypeKey("Das Hxus ist alt.", "Das Haus ist alt.")).toBe("buchstabendreher");
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

describe("detectSeverity", () => {
  const schwere = (a: string, b: string) => detectSeverity(a, b, detectErrorTypeKey(a, b));

  it("stuft Kommas und Dreher als kosmetisch ein", () => {
    expect(schwere("Er kam, und ging.", "Er kam und ging.")).toBe(1);
    expect(schwere("Das Huas ist alt.", "Das Haus ist alt.")).toBe(1);
  });

  it("stuft ein fehlendes Wort als stoerend ein", () => {
    expect(schwere("Er kam zu spät.", "Er kam viel zu spät.")).toBe(2);
  });

  it("stuft Zahlen und Namen als sinnentstellend ein", () => {
    expect(schwere("rund 4,2 Millionen", "rund 2,4 Millionen")).toBe(3);
  });

  it("hebt ein fehlendes nicht auf sinnentstellend", () => {
    expect(schwere("Er war beteiligt.", "Er war nicht beteiligt.")).toBe(3);
  });

  it("hebt gegensaetzliche Wortwahl auf sinnentstellend", () => {
    expect(schwere("Die Kurse steigen deutlich.", "Die Kurse sinken deutlich.")).toBe(3);
  });

  it("gibt ohne erkannte Kategorie keine Schwere", () => {
    expect(detectSeverity("a", "voellig anderes b", null)).toBeNull();
  });
});
