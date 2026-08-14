import { gleicherOrt } from "@korrektur/shared";
import type { Db } from "../db/client.js";
import { faelligeChecks, vermerkeCheck } from "../repo/artikelChecks.js";
import { ARTIKEL_MINDESTZEICHEN } from "../pruefung/languagetool.js";
import { extractArticle } from "./extract.js";
import type { FetchResult } from "./fetch.js";
import { beurteileFundstelle } from "./pruefung.js";
import { robotsWaechter, type WaechterDeps } from "./robots.js";

export interface ArtikelLaufDeps {
  fetchArticle: (url: string) => Promise<FetchResult>;
  now: () => number;
  /** Fehlt sie, wird ohne robots.txt geprueft (Tests, Kommandozeile). */
  holeRobots?: WaechterDeps["holeText"];
}

export interface ArtikelLaufErgebnis {
  geprueft: number;
  unerreichbar: number;
  /** Von der Redaktion per robots.txt ausgeschlossen. */
  ausgeschlossen: number;
  /** Befunde je Zustand, fuer die Ausgabe des Laufs. */
  befunde: Record<string, number>;
}

/**
 * Ein Durchgang der Artikel-Pruefung (Spec §8.1, P5): faellige Meldungen
 * abrufen, die Fundstelle beurteilen, den Befund festhalten. Der Ausgang
 * einer Meldung bleibt unberuehrt — was daraus folgt, entscheidet der
 * Betreiber.
 */
export async function artikelLauf(db: Db, deps: ArtikelLaufDeps): Promise<ArtikelLaufErgebnis> {
  const jetzt = deps.now();
  const ergebnis: ArtikelLaufErgebnis = { geprueft: 0, unerreichbar: 0, ausgeschlossen: 0, befunde: {} };
  const waechter = deps.holeRobots
    ? robotsWaechter({ holeText: deps.holeRobots, now: deps.now })
    : null;

  for (const meldung of faelligeChecks(db, jetzt)) {
    /* Sagt die Redaktion nein, bleibt es beim Vermerk -- so ruht die
       Meldung bis zum naechsten Meilenstein, statt jede Stunde neu zu
       fragen. */
    if (waechter && !(await waechter.darf(meldung.articleUrlCanon))) {
      vermerkeCheck(db, meldung.id, {
        checkedAt: jetzt,
        httpStatus: null,
        zustand: "unreachable",
        beobachtet: "durch robots.txt ausgeschlossen",
        sicherheit: null,
      });
      ergebnis.ausgeschlossen += 1;
      continue;
    }

    const geholt = await deps.fetchArticle(meldung.articleUrlCanon);
    const artikelText = lesbarerArtikel(geholt, meldung.articleUrlCanon);

    if (artikelText === null) {
      vermerkeCheck(db, meldung.id, {
        checkedAt: jetzt,
        httpStatus: geholt.ok ? geholt.status : (geholt.status ?? null),
        zustand: "unreachable",
        beobachtet: null,
        sicherheit: null,
      });
      ergebnis.unerreichbar += 1;
      continue;
    }

    const befund = beurteileFundstelle({
      artikelText,
      quoteBefore: meldung.quoteBefore,
      suggestionAfter: meldung.suggestionAfter,
      prefix: meldung.quotePrefix,
      suffix: meldung.quoteSuffix,
    });
    vermerkeCheck(db, meldung.id, {
      checkedAt: jetzt,
      httpStatus: geholt.ok ? geholt.status : null,
      zustand: befund.zustand,
      beobachtet: befund.beobachtet,
      sicherheit: befund.sicherheit,
    });
    ergebnis.geprueft += 1;
    ergebnis.befunde[befund.zustand] = (ergebnis.befunde[befund.zustand] ?? 0) + 1;
  }

  return ergebnis;
}

/** Der Artikeltext — oder null bei Umleitung, Zustimmungsfenster, Schranke. */
function lesbarerArtikel(geholt: FetchResult, adresse: string): string | null {
  if (!geholt.ok) return null;
  if (!gleicherOrt(adresse, geholt.url)) return null;
  const artikel = extractArticle(geholt.html, adresse);
  if (!artikel) return null;
  return artikel.text.trim().length < ARTIKEL_MINDESTZEICHEN ? null : artikel.text;
}
