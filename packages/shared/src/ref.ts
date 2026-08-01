import { randomInt } from "node:crypto";

/** Crockford-Base32 ohne I, L, O, U — nichts Verwechselbares (§5.2). */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const REF_BODY_LENGTH = 5;

export const REF_PATTERN = /^K[0-9A-HJKMNP-TV-Z]{5}$/;
const SUBJECT_PATTERN = /\[(K[0-9A-HJKMNP-TV-Z]{5})\]/;

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
