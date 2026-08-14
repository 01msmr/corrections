import { describe, expect, it } from "vitest";
import { beurteileFundstelle } from "./pruefung.js";

/* Die Kaskade aus Spec §8.1: Anker suchen, dann die Mitte beurteilen. Ein
   reiner Substring-Test koennte nur "da / weg" -- und "weg" hiesse
   gleichermassen korrigiert, umgeschrieben oder depubliziert. */
const ARTIKEL = (mitte: string): string =>
  `Im vergangenen Jahr nutzten ${mitte} das Angebot. Der Anteil stieg damit erneut an.`;

const BASIS = {
  quoteBefore: "rund 4,2 Millionen Menschen",
  suggestionAfter: "rund 2,4 Millionen Menschen",
  prefix: "Im vergangenen Jahr nutzten ",
  suffix: " das Angebot. Der Anteil stieg",
};

describe("beurteileFundstelle", () => {
  it("erkennt die unveraenderte Stelle", () => {
    const befund = beurteileFundstelle({ ...BASIS, artikelText: ARTIKEL(BASIS.quoteBefore) });
    expect(befund.zustand).toBe("unchanged");
  });

  it("erkennt die Uebernahme des Vorschlags", () => {
    const befund = beurteileFundstelle({ ...BASIS, artikelText: ARTIKEL(BASIS.suggestionAfter) });
    expect(befund.zustand).toBe("changed_as_suggested");
  });

  it("erkennt eine andere Aenderung und haelt fest, was dort steht", () => {
    const befund = beurteileFundstelle({ ...BASIS, artikelText: ARTIKEL("etwa vier Millionen") });
    expect(befund.zustand).toBe("changed_otherwise");
    expect(befund.beobachtet).toBe("etwa vier Millionen");
  });

  it("erkennt die verschwundene Passage", () => {
    const befund = beurteileFundstelle({
      ...BASIS,
      artikelText: "Ein ganz anderer Text ohne die Stelle und ohne ihre Umgebung.",
    });
    expect(befund.zustand).toBe("passage_gone");
    expect(befund.beobachtet).toBeNull();
  });

  it("kommt ohne Anker aus: dann entscheidet der Substring", () => {
    const ohneAnker = { ...BASIS, prefix: null, suffix: null };
    expect(
      beurteileFundstelle({ ...ohneAnker, artikelText: ARTIKEL(BASIS.quoteBefore) }).zustand,
    ).toBe("unchanged");
    expect(
      beurteileFundstelle({ ...ohneAnker, artikelText: ARTIKEL(BASIS.suggestionAfter) }).zustand,
    ).toBe("changed_as_suggested");
    expect(beurteileFundstelle({ ...ohneAnker, artikelText: "nichts davon" }).zustand).toBe(
      "passage_gone",
    );
  });

  it("stoert sich nicht an Leerraum und Anfuehrungszeichen", () => {
    /* Normalisierung ist Pflicht (Spec §8.2): geschuetzte Leerzeichen und
       typografische Anfuehrungszeichen kommen aus jedem CMS anders. */
    const befund = beurteileFundstelle({
      ...BASIS,
      artikelText: "Im vergangenen  Jahr nutzten rund 4,2 Millionen Menschen\ndas Angebot. Der Anteil stieg",
    });
    expect(befund.zustand).toBe("unchanged");
  });
});
