import { describe, expect, it } from "vitest";
import {
  findeZuordnung,
  kennungAusBetreff,
  normBetreff,
  type AntwortKandidat,
} from "./antworten.js";

const KANDIDATEN: AntwortKandidat[] = [
  {
    id: "neu-1",
    ref: "K7QW3",
    messageId: "abc123@korrekturen.msmr.co",
    headlineNorm: normBetreff("Die Bahn im Dauertest"),
    domains: ["beispiel-zeitung.de"],
  },
  {
    id: "alt-1",
    ref: "KALT1",
    messageId: null,
    headlineNorm: normBetreff("Kann die Bahn ihn wiederbeleben?"),
    domains: ["muster-magazin.de"],
  },
  {
    id: "alt-2",
    ref: "KALT2",
    messageId: null,
    headlineNorm: normBetreff("Kann die Bahn ihn wiederbeleben?"),
    domains: ["probe-anzeiger.de"],
  },
];

describe("kennungAusBetreff / normBetreff", () => {
  it("liest die Kennung am Ende und laesst sie beim Normieren weg", () => {
    expect(kennungAusBetreff("Re: Korrektur: Die Bahn [K7QW3]")).toBe("K7QW3");
    expect(normBetreff("AW: Re: Die Bahn im Dauertest [K7QW3]")).toBe(
      normBetreff("Die Bahn im Dauertest"),
    );
  });

  it("raeumt gestapelte Antwort-Vorsaetze ab", () => {
    expect(normBetreff("AW: AW: WG: Kann die Bahn ihn wiederbeleben?")).toBe(
      normBetreff("Kann die Bahn ihn wiederbeleben?"),
    );
  });
});

describe("findeZuordnung", () => {
  it("nimmt die Kennung vor allem anderen", () => {
    const treffer = findeZuordnung(
      { betreff: "Re: Irgendwas ganz anderes [K7QW3]", inReplyTo: null, absender: "x@y.de" },
      KANDIDATEN,
    );
    expect(treffer).toEqual({ id: "neu-1", weg: "kennung" });
  });

  it("folgt dem Faden ueber In-Reply-To", () => {
    const treffer = findeZuordnung(
      { betreff: "Re: ohne Kennung", inReplyTo: "abc123@korrekturen.msmr.co", absender: null },
      KANDIDATEN,
    );
    expect(treffer).toEqual({ id: "neu-1", weg: "faden" });
  });

  it("ordnet alte Antworten ueber Titel UND Absender-Domain zu", () => {
    /* Zwei Meldungen tragen denselben Titel — erst die Domain macht es
       eindeutig. Subdomains gelten mit. */
    const treffer = findeZuordnung(
      {
        betreff: "Re: Kann die Bahn ihn wiederbeleben?",
        inReplyTo: null,
        absender: "leserbriefe@redaktion.muster-magazin.de",
      },
      KANDIDATEN,
    );
    expect(treffer).toEqual({ id: "alt-1", weg: "titel" });
  });

  it("laesst mehrdeutige oder domainfremde Titel liegen", () => {
    expect(
      findeZuordnung(
        { betreff: "Re: Kann die Bahn ihn wiederbeleben?", inReplyTo: null, absender: "a@fremd.de" },
        KANDIDATEN,
      ),
    ).toBeNull();
    expect(
      findeZuordnung({ betreff: "Re: Voellig unbekannt", inReplyTo: null, absender: "a@b.de" }, KANDIDATEN),
    ).toBeNull();
  });

  /* Der Kurzbefehl setzte schon vor dem Projekt denselben Betreff-Praefix;
     ohne ihn zu streichen trifft der Titel-Weg nie. */
  it("ordnet ueber den Titel zu, obwohl der Betreff den eigenen Praefix traegt", () => {
    expect(
      findeZuordnung(
        {
          betreff: "Textfehler im Artikel: Kann die Bahn ihn wiederbeleben?",
          inReplyTo: null,
          absender: "leserservice@muster-magazin.de",
        },
        KANDIDATEN,
      ),
    ).toEqual({ id: "alt-1", weg: "titel" });
  });

  it("erkennt den gekuerzten Betreff wieder", () => {
    expect(
      findeZuordnung(
        {
          betreff: "Re: Textfehler im Artikel: Kann die Bahn ihn wieder…",
          inReplyTo: null,
          absender: "leserservice@muster-magazin.de",
        },
        KANDIDATEN,
      ),
    ).toEqual({ id: "alt-1", weg: "titel" });
  });

  it("laesst einen zu kurzen Betreff-Anfang liegen", () => {
    expect(
      findeZuordnung(
        { betreff: "Textfehler im Artikel: Kann…", inReplyTo: null, absender: "a@muster-magazin.de" },
        KANDIDATEN,
      ),
    ).toBeNull();
  });
});
