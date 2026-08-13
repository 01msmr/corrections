import { BESTAETIGUNGS_MUSTER } from "@korrektur/shared";

/**
 * Erkennung von Eingangsbestaetigungen — rein, ohne IO (Projektregel).
 *
 * Zwei Bedingungen muessen zusammenkommen, damit eine Mail als Bestaetigung
 * gilt und in den Papierkorb darf:
 *
 * 1. **Muster:** Betreff oder Textanfang enthaelt eines der
 *    BESTAETIGUNGS_MUSTER (z. B. SPIEGEL: "Gerne sichten wir …").
 * 2. **Bezug:** Die Mail bezieht sich nachweislich auf eine unserer
 *    Korrekturen — Kennung im Betreff ("[K…]") oder In-Reply-To auf eine
 *    bekannte Message-ID.
 *
 * Ohne Bezug bleibt die Mail liegen: lieber eine Bestaetigung stehen lassen
 * als eine fremde Mail verschieben.
 */

export interface MailMerkmale {
  betreff: string;
  /** Anfang des Textkoerpers; leer, wenn nicht geladen. */
  textAnfang: string;
  /** In-Reply-To-Header ohne spitze Klammern, null wenn nicht gesetzt. */
  inReplyTo: string | null;
}

/** Kennung im Betreff: " [K…]" wie von composeMail vergeben. */
const KENNUNG_MUSTER = /\[K[A-Z0-9]+\]/;

/** Nur die Wortmarke, ohne Bezugspruefung -- fuer schon zugeordnete Ereignisse. */
export function passtAufBestaetigungsmuster(text: string): boolean {
  const klein = text.toLowerCase();
  return BESTAETIGUNGS_MUSTER.some((muster) => klein.includes(muster));
}

export function istEingangsbestaetigung(
  mail: MailMerkmale,
  bekannteMessageIds: ReadonlySet<string>,
): boolean {
  const musterTreffer = passtAufBestaetigungsmuster(`${mail.betreff}\n${mail.textAnfang}`);
  if (!musterTreffer) return false;

  const kennungTreffer = KENNUNG_MUSTER.test(mail.betreff) || KENNUNG_MUSTER.test(mail.textAnfang);
  const antwortAufBekannte =
    mail.inReplyTo !== null && bekannteMessageIds.has(mail.inReplyTo);
  return kennungTreffer || antwortAufBekannte;
}
