import { diffWords } from "./diff.js";
import { normalizeText } from "./text.js";

/**
 * Automatische Kategorie-Erkennung aus dem Paar Fundstelle/Berichtigung.
 *
 * Rein und bewusst konservativ: lieber kein Vorschlag als ein falscher —
 * `null` heisst "keine Vorauswahl", nie "keine Kategorie". Die Schluessel
 * entsprechen dem Seed; ob sie in der Datenbank (noch) existieren, prueft
 * der Aufrufer.
 */
export type DetectedErrorTypeKey =
  | "zeichen_fehlt"
  | "zeichen_zu_viel"
  | "buchstabendreher"
  | "komma_fehlt"
  | "komma_zu_viel"
  | "wort_fehlt"
  | "wort_zu_viel"
  | "falsche_zahl"
  | "falsches_datum"
  | "falscher_name"
  | "falsche_wortwahl"
  | "satzbau";

const MONATE =
  /^(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|jan|feb|mär|apr|jun|jul|aug|sep|okt|nov|dez)\.?,?$/i;

/** Tag ("5.") oder Jahreszahl — die Formen, in denen Daten im Fliesstext stehen. */
function istDatumswort(wort: string): boolean {
  const kern = wort.replace(/[,;:]$/, "");
  return /^\d{1,2}\.$/.test(kern) || /^(1[6-9]|20)\d\d$/.test(kern) || MONATE.test(kern);
}

/** Ergibt `lang` durch Einfuegen genau eines Zeichens aus `kurz`? */
function umEinZeichenErgaenzt(kurz: string, lang: string): boolean {
  if (lang.length !== kurz.length + 1) return false;
  let i = 0;
  let uebersprungen = false;
  for (let j = 0; j < lang.length; j++) {
    if (kurz[i] === lang[j]) {
      i++;
    } else if (uebersprungen) {
      return false;
    } else {
      uebersprungen = true;
    }
  }
  return true;
}

/** Genau zwei benachbarte Zeichen vertauscht, sonst identisch? */
function istDreher(a: string, b: string): boolean {
  if (a.length !== b.length || a === b) return false;
  const diff: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
  if (diff.length !== 2) return false;
  const erste = diff[0];
  const zweite = diff[1];
  if (erste === undefined || zweite === undefined || zweite !== erste + 1) return false;
  return a[erste] === b[zweite] && a[zweite] === b[erste];
}

interface Geaendert {
  wort: string;
  index: number;
}

function geaenderteWoerter(segmente: { text: string; changed: boolean }[]): Geaendert[] {
  const treffer: Geaendert[] = [];
  let index = 0;
  for (const segment of segmente) {
    if (/^\s+$/.test(segment.text)) continue;
    if (segment.changed) treffer.push({ wort: segment.text, index });
    index++;
  }
  return treffer;
}

export function detectErrorTypeKey(falsch: string, richtig: string): DetectedErrorTypeKey | null {
  const a = normalizeText(falsch);
  const b = normalizeText(richtig);
  if (a.length === 0 || b.length === 0 || a === b) return null;

  // Nur Kommas verschieden? Dann entscheidet ihre Anzahl.
  const ohneKommaA = a.replace(/,/g, "").replace(/\s+/g, " ").trim();
  const ohneKommaB = b.replace(/,/g, "").replace(/\s+/g, " ").trim();
  if (ohneKommaA === ohneKommaB) {
    const kommasA = (a.match(/,/g) ?? []).length;
    const kommasB = (b.match(/,/g) ?? []).length;
    if (kommasB > kommasA) return "komma_fehlt";
    if (kommasB < kommasA) return "komma_zu_viel";
    return null; // verschobenes Komma: kein eindeutiger Schluessel
  }

  const diff = diffWords(a, b);
  const inFalsch = geaenderteWoerter(diff.before);
  const inRichtig = geaenderteWoerter(diff.after);

  if (inFalsch.length === 0 && inRichtig.length === 1) return "wort_fehlt";
  if (inFalsch.length === 1 && inRichtig.length === 0) return "wort_zu_viel";

  if (inFalsch.length === 1 && inRichtig.length === 1) {
    const alt = inFalsch[0];
    const neu = inRichtig[0];
    if (!alt || !neu) return null;

    // Monatsnamen zuerst: "Januar" gegen "Februar" traegt keine Ziffer und
    // saehe sonst wie ein verwechselter Eigenname aus.
    if (MONATE.test(alt.wort) && MONATE.test(neu.wort)) return "falsches_datum";
    if (/\d/.test(alt.wort) && /\d/.test(neu.wort)) {
      return istDatumswort(alt.wort) || istDatumswort(neu.wort) ? "falsches_datum" : "falsche_zahl";
    }
    if (istDreher(alt.wort, neu.wort)) return "buchstabendreher";
    if (umEinZeichenErgaenzt(alt.wort, neu.wort)) return "zeichen_fehlt";
    if (umEinZeichenErgaenzt(neu.wort, alt.wort)) return "zeichen_zu_viel";
    // Grossgeschrieben mitten im Satz: sehr wahrscheinlich ein Eigenname. Am
    // Anfang traegt die Grossschreibung nichts, dort beginnt jeder Satz so.
    if (
      alt.index > 0 &&
      neu.index > 0 &&
      /^\p{Lu}/u.test(alt.wort) &&
      /^\p{Lu}/u.test(neu.wort)
    ) {
      return "falscher_name";
    }
    return "falsche_wortwahl";
  }

  // Gleiche Woerter, andere Reihenfolge: ein Satzbau-Fall.
  const sortiertA = [...ohneKommaA.split(" ")].sort();
  const sortiertB = [...ohneKommaB.split(" ")].sort();
  if (sortiertA.length === sortiertB.length && sortiertA.every((w, i) => w === sortiertB[i])) {
    return "satzbau";
  }

  return null;
}

/** Woerter, deren Fehlen oder Auftauchen die Aussage umkehrt. */
const NEGATIONEN = new Set([
  "nicht", "kein", "keine", "keinen", "keinem", "keiner", "nie", "niemals", "nichts",
]);

/** Gegensatzpaare: ein Tausch innerhalb eines Paars kehrt die Aussage um. */
const GEGENSAETZE = [
  ["mehr", "weniger"], ["über", "unter"], ["vor", "nach"], ["für", "gegen"],
  ["mit", "ohne"], ["steigt", "sinkt"], ["steigt", "fällt"], ["steigen", "sinken"],
  ["gewinnt", "verliert"], ["erlaubt", "verboten"], ["richtig", "falsch"],
  ["ja", "nein"], ["alle", "keine"], ["immer", "nie"], ["links", "rechts"],
];
const GEGENSATZ_SCHLUESSEL = new Set(GEGENSAETZE.map((paar) => [...paar].sort().join("|")));

function kern(wort: string): string {
  return wort.toLowerCase().replace(/[.,;:!?»«"']+$/g, "").replace(/^[»«"']+/g, "");
}

/**
 * Schwere zum erkannten Fall: 1 kosmetisch, 2 stoerend, 3 sinnentstellend.
 * Grundlage ist die Kategorie; eine Negation oder ein Gegensatzpaar hebt auf
 * sinnentstellend, weil die Aussage dann kippt statt nur zu holpern.
 */
export function detectSeverity(
  falsch: string,
  richtig: string,
  kategorie: DetectedErrorTypeKey | null,
): 1 | 2 | 3 | null {
  if (kategorie === null) return null;

  const diff = diffWords(normalizeText(falsch), normalizeText(richtig));
  const inFalsch = geaenderteWoerter(diff.before).map((g) => kern(g.wort));
  const inRichtig = geaenderteWoerter(diff.after).map((g) => kern(g.wort));

  const kippt =
    [...inFalsch, ...inRichtig].some((w) => NEGATIONEN.has(w)) ||
    (inFalsch.length === 1 &&
      inRichtig.length === 1 &&
      GEGENSATZ_SCHLUESSEL.has([inFalsch[0] ?? "", inRichtig[0] ?? ""].sort().join("|")));
  if (kippt) return 3;

  switch (kategorie) {
    case "komma_fehlt":
    case "komma_zu_viel":
    case "zeichen_fehlt":
    case "zeichen_zu_viel":
    case "buchstabendreher":
      return 1;
    case "wort_fehlt":
    case "wort_zu_viel":
    case "falsche_wortwahl":
    case "satzbau":
      return 2;
    case "falsche_zahl":
    case "falsches_datum":
    case "falscher_name":
      return 3;
  }
}
