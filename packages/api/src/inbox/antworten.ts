import { SUBJECT_PREFIX, normalizeText } from "@korrektur/shared";

/**
 * Zuordnung eingehender Redaktionsantworten zu Meldungen (P3). Rein, ohne
 * IO — der Postfachzugriff liegt in postfach.ts, das Schreiben in
 * repo/antworten.ts.
 *
 * Drei Wege, der sicherste zuerst:
 *
 * 1. **Kennung:** composeMail haengt sie ans Ende des Betreffs ("… [K7QW3]").
 *    Bleibt sie in der Antwort stehen, ist die Zuordnung eindeutig.
 * 2. **Faden:** In-Reply-To der Antwort zeigt auf die Message-ID unserer
 *    Korrekturmail.
 * 3. **Titel:** Die alten Meldungen (vor diesem Projekt) trugen den
 *    Artikeltitel als Betreff — ihre Antworten heissen "Re: <Titel>". Der
 *    Weg ist der unschaerfste und gilt deshalb nur, wenn der bereinigte
 *    Betreff genau eine Meldung trifft UND der Absender zur Domain des
 *    Mediums passt. Lieber keine Zuordnung als eine falsche.
 */

/** Der Ausschnitt einer Meldung, den die Zuordnung braucht. */
export interface AntwortKandidat {
  id: string;
  ref: string;
  /** Message-ID der Korrekturmail, ohne spitze Klammern; null bei mailto. */
  messageId: string | null;
  /** Ueber normBetreff gelaufene Ueberschrift; null ohne Ueberschrift. */
  headlineNorm: string | null;
  /** Domains des Mediums, kleingeschrieben. */
  domains: readonly string[];
}

export interface EingehendeMail {
  betreff: string;
  /** Ohne spitze Klammern; null, wenn die Antwort keinen Faden traegt. */
  inReplyTo: string | null;
  /** Absender-Adresse; fuer den Domain-Abgleich des Titel-Wegs. */
  absender: string | null;
}

/** Antwort-Vorsaetze ("Re:", "AW:", auch gestapelt) und Lesezeichen davor. */
const VORSATZ = /^\s*((re|aw|wg|fw|fwd|antw)\s*(\^\d+)?\s*:\s*)+/i;

/** Die Kennung am Ende des Betreffs, wie buildSubject sie vergibt. */
const KENNUNG = /\[([A-Z0-9]{4,12})\]\s*$/;

/** Unser eigener Betreff-Anfang; ohne Doppelpunkt, den nimmt \s*:?\s* mit. */
const PRAEFIX = new RegExp(`^\\s*${SUBJECT_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:?\\s*`, "i");

/** NFKC macht aus dem Auslassungszeichen drei Punkte. */
const GEKUERZT = /\.\.\.$/;

/** So viele Zeichen muss ein gekuerzter Betreff mindestens tragen. */
const MINDEST_ANFANG = 20;

export function kennungAusBetreff(betreff: string): string | null {
  return KENNUNG.exec(betreff.trim())?.[1] ?? null;
}

/**
 * Macht Betreffe vergleichbar: Antwort-Vorsaetze und Kennung fallen weg,
 * Typografie wird geglaettet, Gross/Klein eingeebnet.
 */
export function normBetreff(betreff: string): string {
  return normalizeText(betreff.replace(VORSATZ, "").replace(KENNUNG, "").replace(PRAEFIX, ""))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Betreff und Ueberschrift derselbe Text? buildSubject kuerzt lange
 * Ueberschriften gegen ein Budget -- ein gekuerzter Betreff gilt, wenn die
 * Ueberschrift mit ihm anfaengt und der Anfang lang genug ist, um zu
 * unterscheiden.
 */
function titelPasst(betreffNorm: string, headlineNorm: string | null): boolean {
  if (headlineNorm === null || betreffNorm.length === 0) return false;
  if (betreffNorm === headlineNorm) return true;
  if (!GEKUERZT.test(betreffNorm)) return false;
  const anfang = betreffNorm.replace(GEKUERZT, "").trimEnd();
  return anfang.length >= MINDEST_ANFANG && headlineNorm.startsWith(anfang);
}

function absenderDomain(absender: string | null): string | null {
  const teil = absender?.split("@")[1]?.toLowerCase().trim();
  return teil ? teil : null;
}

/** Passt die Absender-Domain zum Medium? Subdomains gelten mit. */
function domainPasst(absender: string | null, domains: readonly string[]): boolean {
  const domain = absenderDomain(absender);
  if (!domain) return false;
  return domains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export type ZuordnungsWeg = "kennung" | "faden" | "titel";

export function findeZuordnung(
  mail: EingehendeMail,
  kandidaten: readonly AntwortKandidat[],
): { id: string; weg: ZuordnungsWeg } | null {
  const kennung = kennungAusBetreff(mail.betreff);
  if (kennung) {
    const treffer = kandidaten.find((k) => k.ref === kennung);
    if (treffer) return { id: treffer.id, weg: "kennung" };
  }

  if (mail.inReplyTo) {
    const treffer = kandidaten.find((k) => k.messageId !== null && k.messageId === mail.inReplyTo);
    if (treffer) return { id: treffer.id, weg: "faden" };
  }

  const titel = normBetreff(mail.betreff);
  if (titel.length > 0) {
    const passende = kandidaten.filter(
      (k) => titelPasst(titel, k.headlineNorm) && domainPasst(mail.absender, k.domains),
    );
    const einzige = passende[0];
    if (passende.length === 1 && einzige) return { id: einzige.id, weg: "titel" };
  }

  return null;
}
