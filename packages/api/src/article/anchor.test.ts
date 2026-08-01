import { describe, expect, it } from "vitest";
import { deriveAnchors } from "./anchor.js";

const TEXT =
  "Der Verkehrsverbund meldet einen Zuwachs. Im vergangenen Jahr nutzten rund 4,2 Millionen Menschen die Linie, ein Plus von zwoelf Prozent. Fuer das laufende Jahr rechnet der Verbund mit einer weiteren Steigerung.";

describe("deriveAnchors", () => {
  it("meldet exact bei eindeutigem Zitat und schneidet Kontext heraus", () => {
    const result = deriveAnchors(TEXT, "rund 4,2 Millionen Menschen");
    expect(result.quality).toBe("exact");
    expect(result.positionHint).toBe(0);
    expect(result.prefix).toContain("Im vergangenen Jahr nutzten");
    expect(result.suffix).toContain("die Linie");
  });

  it("begrenzt Prefix und Suffix auf die konfigurierte Länge", () => {
    const result = deriveAnchors(TEXT, "rund 4,2 Millionen Menschen");
    expect(result.prefix?.length).toBeLessThanOrEqual(48);
    expect(result.suffix?.length).toBeLessThanOrEqual(48);
  });

  it("meldet context bei mehrfachem Vorkommen und wählt das erste", () => {
    const result = deriveAnchors("Alpha Beta Gamma. Delta Beta Epsilon.", "Beta");
    expect(result.quality).toBe("context");
    expect(result.positionHint).toBe(0);
    expect(result.prefix).toBe("Alpha ");
    expect(result.suffix).toBe(" Gamma. Delta Beta Epsilon.");
  });

  it("meldet none, wenn das Zitat nicht vorkommt", () => {
    expect(deriveAnchors(TEXT, "Ein Satz, der nirgends steht")).toEqual({
      quality: "none",
      prefix: null,
      suffix: null,
      positionHint: null,
    });
  });

  it("findet das Zitat trotz abweichender Typografie", () => {
    const result = deriveAnchors('Sie sagte: "Wir haben geprüft" und ging.', "„Wir haben geprüft”");
    expect(result.quality).toBe("exact");
  });

  it("liefert leere Kontexte am Textrand statt null", () => {
    const result = deriveAnchors("Anfang und Ende", "Anfang");
    expect(result.quality).toBe("exact");
    expect(result.prefix).toBe("");
    expect(result.suffix).toBe(" und Ende");
  });
});
