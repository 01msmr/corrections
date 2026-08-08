import { describe, expect, it } from "vitest";
import { istBuchstabendreher, ordneAlleZu, ordneZu, type LtBefund } from "./zuordnung.js";

/** Baut einen Befund, wie ihn die LanguageTool-Antwort liefert. */
function befund(teile: Partial<LtBefund> & Pick<LtBefund, "offset" | "length">): LtBefund {
  return {
    message: "Hinweis",
    replacements: [{ value: "richtig" }],
    rule: { id: "REGEL", issueType: "misspelling", category: { id: "TYPOS" } },
    ...teile,
  };
}

describe("istBuchstabendreher", () => {
  it("erkennt den Tausch zweier Nachbarn", () => {
    expect(istBuchstabendreher("Mietwgaen", "Mietwagen")).toBe(true);
    expect(istBuchstabendreher("Fehelr", "Fehler")).toBe(true);
  });

  it("verneint bei anderer Laenge oder anderer Abweichung", () => {
    expect(istBuchstabendreher("Feler", "Fehler")).toBe(false); // fehlender Buchstabe
    expect(istBuchstabendreher("Haus", "Maus")).toBe(false); // ein Zeichen getauscht
    expect(istBuchstabendreher("abcd", "badc")).toBe(false); // zwei Tausche
    expect(istBuchstabendreher("Haus", "Haus")).toBe(false);
  });
});

describe("ordneZu", () => {
  const text = "Erster Satz mit Fehelr. Wer nicht aufpasst könnte etwas verlieren.";
  const bereiche: [number, number][] = [
    [0, 23],
    [24, 66],
  ];

  it("schneidet Fundstelle und Satz exakt aus und markiert die Stelle im Satz", () => {
    const fund = ordneZu(
      befund({ offset: 16, length: 6, replacements: [{ value: "Fehler" }] }),
      text,
      bereiche,
    );
    expect(fund).not.toBeNull();
    expect(fund?.falsch).toBe("Fehelr");
    expect(fund?.richtig).toBe("Fehler");
    expect(fund?.satz).toBe("Erster Satz mit Fehelr.");
    // Die Markierung muss im Satz auf dieselbe Stelle zeigen.
    expect(fund?.satz.slice(fund.start, fund.start + fund.laenge)).toBe("Fehelr");
    expect(fund?.fehlerartKey).toBe("buchstabendreher");
  });

  it("findet den zweiten Satz ueber die Bereiche, nicht ueber Suchen", () => {
    const fund = ordneZu(
      befund({
        offset: 34,
        length: 8,
        replacements: [{ value: "aufpasst," }],
        rule: {
          id: "KOMMA_ZWISCHEN_HAUPT_UND_NEBENSATZ_2",
          issueType: "uncategorized",
          category: { id: "HILFESTELLUNG_KOMMASETZUNG" },
        },
      }),
      text,
      bereiche,
    );
    expect(fund?.satz).toBe("Wer nicht aufpasst könnte etwas verlieren.");
    expect(fund?.satz.slice(fund.start, fund.start + fund.laenge)).toBe("aufpasst");
    expect(fund?.fehlerartKey).toBe("komma_fehlt");
  });

  it("verwirft Befunde ohne Vorschlag und solche, die nichts aendern", () => {
    expect(ordneZu(befund({ offset: 16, length: 6, replacements: [] }), text, bereiche)).toBeNull();
    expect(
      ordneZu(
        befund({ offset: 16, length: 6, replacements: [{ value: "Fehelr" }] }),
        text,
        bereiche,
      ),
    ).toBeNull();
  });

  it("trennt Stil von harten Befunden", () => {
    const stil = ordneZu(
      befund({
        offset: 16,
        length: 6,
        replacements: [{ value: "Fehler" }],
        rule: { id: "KOMP_WIE", issueType: "style", category: { id: "STIL" } },
      }),
      text,
      bereiche,
    );
    expect(stil?.art).toBe("stil");
  });
});

describe("ordneAlleZu", () => {
  it("stellt harte Befunde vor die Stil-Befunde", () => {
    const text = "Ein Fehelr und ein Stil.";
    const bereiche: [number, number][] = [[0, text.length]];
    const funde = ordneAlleZu(
      [
        befund({
          offset: 19,
          length: 4,
          replacements: [{ value: "Ton" }],
          rule: { id: "KOMP_WIE", issueType: "style", category: { id: "STIL" } },
        }),
        befund({ offset: 4, length: 6, replacements: [{ value: "Fehler" }] }),
      ],
      text,
      bereiche,
    );
    expect(funde.map((f) => f.art)).toEqual(["hart", "stil"]);
    expect(funde[0]?.falsch).toBe("Fehelr");
  });
});

describe("Zusammenfassen gleicher Stellen", () => {
  it("meldet dieselbe Fundstelle einmal mit Anzahl", () => {
    const text = "Ein Feler hier. Ein Feler dort. Ein Feler ganz am Ende.";
    const bereiche: [number, number][] = [[0, text.length]];
    const stellen = [4, 20, 36].map((offset) =>
      befund({ offset, length: 5, replacements: [{ value: "Fehler" }] }),
    );
    const funde = ordneAlleZu(stellen, text, bereiche);
    expect(funde).toHaveLength(1);
    expect(funde[0]?.anzahl).toBe(3);
    // Der Satz des ersten Vorkommens bleibt erhalten.
    expect(funde[0]?.satz).toBe(text);
  });
});
