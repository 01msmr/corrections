/** Eine Meldung zählt erst nach dieser Frist in einen Quoten-Nenner (§9.3). */
export const MATURITY_DAYS = 14;
export const MATURITY_SECONDS = MATURITY_DAYS * 24 * 60 * 60;

/** Unterhalb dieser Fallzahl wird keine Quote angezeigt, nur Rohzahlen (§9.4). */
export const MIN_N_FOR_RATE = 10;

/** z-Wert für das 95-%-Wilson-Intervall (§9.4). */
export const CONFIDENCE_Z = 1.959964;

/** Obergrenze für zitierte Fundstellen, Zitatrecht (§12). */
export const QUOTE_MAX_LENGTH = 200;

/** Zeichen vor und nach der Fundstelle je Kontext-Anker (§8.1). */
export const ANCHOR_LENGTH = 48;
