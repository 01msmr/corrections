import { randomInt } from "node:crypto";

/** Crockford-Base32 ohne I, L, O, U — nichts Verwechselbares (§5.2). */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const REF_BODY_LENGTH = 5;

/**
 * Beide Muster werden aus ALPHABET abgeleitet, nicht danebengeschrieben.
 * Eine zweite, von Hand gepflegte Zeichenklasse koennte vom Alphabet
 * abweichen — dann erzeugte generateRef Token, die isRef ablehnt, und der
 * Fehler zeigte sich erst, wenn genau dieses Zeichen gezogen wird.
 */
const BODY_CLASS = `[${ALPHABET}]{${REF_BODY_LENGTH}}`;

export const REF_PATTERN = new RegExp(`^K${BODY_CLASS}$`);
const SUBJECT_PATTERN = new RegExp(`\\[(K${BODY_CLASS})\\]`);

export function generateRef(): string {
  let body = "";
  for (let i = 0; i < REF_BODY_LENGTH; i++) {
    body += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `K${body}`;
}

export function isRef(value: string): boolean {
  return REF_PATTERN.test(value);
}

/** Sucht im gesamten Betreff, nicht nur am Ende (§7, Stufe 2). */
export function extractRefFromSubject(subject: string): string | null {
  const match = SUBJECT_PATTERN.exec(subject);
  return match?.[1] ?? null;
}
