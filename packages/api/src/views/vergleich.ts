/**
 * Wortweiser Vergleich der beiden Fassungen fuer die Korrekturfahne (§3.3:
 * die Fassungen sind wortgleich erfasst, verglichen wird deshalb auf
 * Wortebene). Reine Funktion ohne IO; Weissraum wird fuer die Fahne auf
 * einfache Leerzeichen normalisiert, die Feldwerte selbst bleiben unberuehrt.
 */
export interface FahnenStueck {
  art: "gleich" | "getilgt" | "eingefuegt";
  text: string;
}

export function vergleicheFassungen(falsch: string, richtig: string): FahnenStueck[] {
  const alt = falsch.split(/\s+/).filter(Boolean);
  const neu = richtig.split(/\s+/).filter(Boolean);

  /* Laengste gemeinsame Teilfolge, klassisch tabelliert -- die Zitate sind
     auf QUOTE_MAX_LENGTH begrenzt, die Tabelle bleibt winzig. */
  const lcs: number[][] = Array.from({ length: alt.length + 1 }, () =>
    new Array<number>(neu.length + 1).fill(0),
  );
  for (let i = alt.length - 1; i >= 0; i--) {
    for (let j = neu.length - 1; j >= 0; j--) {
      const rechtsUnten = lcs[i + 1]?.[j + 1] ?? 0;
      const unten = lcs[i + 1]?.[j] ?? 0;
      const rechts = lcs[i]?.[j + 1] ?? 0;
      const zeile = lcs[i];
      if (zeile) {
        zeile[j] = alt[i] === neu[j] ? rechtsUnten + 1 : Math.max(unten, rechts);
      }
    }
  }

  const stuecke: FahnenStueck[] = [];
  const lege = (art: FahnenStueck["art"], wort: string): void => {
    const letztes = stuecke[stuecke.length - 1];
    if (letztes && letztes.art === art) {
      letztes.text += ` ${wort}`;
    } else {
      stuecke.push({ art, text: wort });
    }
  };

  let i = 0;
  let j = 0;
  while (i < alt.length && j < neu.length) {
    const wortAlt = alt[i];
    const wortNeu = neu[j];
    if (wortAlt === undefined || wortNeu === undefined) break;
    if (wortAlt === wortNeu) {
      lege("gleich", wortAlt);
      i += 1;
      j += 1;
    } else if ((lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0)) {
      lege("getilgt", wortAlt);
      i += 1;
    } else {
      lege("eingefuegt", wortNeu);
      j += 1;
    }
  }
  for (; i < alt.length; i += 1) {
    const wort = alt[i];
    if (wort !== undefined) lege("getilgt", wort);
  }
  for (; j < neu.length; j += 1) {
    const wort = neu[j];
    if (wort !== undefined) lege("eingefuegt", wort);
  }
  return stuecke;
}
