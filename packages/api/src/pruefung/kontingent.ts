import { createHash, randomBytes } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { pruefKontingent, pruefSalz } from "../db/schema.js";

/**
 * Kontingent der Rechtschreibpruefung (Spec 2026-08-08).
 *
 * Die oeffentliche LanguageTool-API untersagt automatisierte Anfragen. Der
 * Betreiber loest sie von Hand aus; fuer Besucher gilt ein Tageskontingent,
 * damit dieser Server nicht zum Bot wird.
 *
 * "Pro Person" ohne gespeicherte IP: gezaehlt wird ein Hash aus Tagessalz
 * und IP. Das Salz ist Zufall, wird nur fuer den laufenden Tag aufbewahrt
 * und mit ihm geloescht — danach fuehrt kein Weg vom Hash zurueck zur
 * Person (§2.1).
 */

/** Zeile, die die Tagessumme haelt — kein gueltiger Hash, daher kollisionsfrei. */
const GESAMT = "#gesamt";

export const BESUCHER_PRO_TAG = 2;
/** Ab dieser Tagessumme bekommt jeder Besucher nur noch eine Pruefung. */
export const TAGESGRENZE = 20;
export const BESUCHER_KNAPP = 1;

/**
 * Rein: Wie viele Pruefungen stehen einem Besucher heute noch zu? Bei
 * knapper Tagessumme sinkt das Kontingent von zwei auf eine.
 */
export function verbleibend(bisherPerson: number, bisherGesamt: number): number {
  const kontingent = bisherGesamt >= TAGESGRENZE ? BESUCHER_KNAPP : BESUCHER_PRO_TAG;
  return Math.max(0, kontingent - bisherPerson);
}

/** "2026-08-09" in UTC — der Tag, auf den Salz und Zaehlung lauten. */
export function tagesschluessel(jetzt: number): string {
  return new Date(jetzt * 1000).toISOString().slice(0, 10);
}

/**
 * Holt das Salz des Tages und legt es an, wenn es noch keins gibt. Dabei
 * fallen die Zeilen aller frueheren Tage weg — mit dem alten Salz ist die
 * Zaehlung des Vortags ohnehin nicht mehr zuzuordnen.
 */
function salzFuer(db: Db, tag: string): string {
  const vorhanden = db.select().from(pruefSalz).where(eq(pruefSalz.tag, tag)).get();
  if (vorhanden) return vorhanden.salz;

  db.delete(pruefSalz).where(ne(pruefSalz.tag, tag)).run();
  db.delete(pruefKontingent).where(ne(pruefKontingent.tag, tag)).run();
  const salz = randomBytes(32).toString("hex");
  db.insert(pruefSalz).values({ tag, salz }).run();
  return salz;
}

/** Kennung einer Person fuer genau diesen Tag. */
function kennungFuer(salz: string, ip: string): string {
  return createHash("sha256").update(`${salz}:${ip}`).digest("hex").slice(0, 32);
}

function standFuer(db: Db, tag: string, kennung: string): number {
  return (
    db
      .select({ anzahl: pruefKontingent.anzahl })
      .from(pruefKontingent)
      .where(and(eq(pruefKontingent.tag, tag), eq(pruefKontingent.kennung, kennung)))
      .get()?.anzahl ?? 0
  );
}

function erhoehe(db: Db, tag: string, kennung: string): void {
  db.insert(pruefKontingent)
    .values({ tag, kennung, anzahl: 1 })
    .onConflictDoUpdate({
      target: [pruefKontingent.tag, pruefKontingent.kennung],
      set: { anzahl: sql`${pruefKontingent.anzahl} + 1` },
    })
    .run();
}

export interface KontingentErgebnis {
  erlaubt: boolean;
  /** Wie viele Pruefungen der Person heute noch bleiben (nach dieser). */
  verbleibend: number;
}

/**
 * Bucht eine Pruefung fuer einen Besucher — oder lehnt sie ab, wenn das
 * Kontingent erschoepft ist. Gebucht wird nur, was auch erlaubt ist.
 */
export function bucheBesucherPruefung(db: Db, ip: string, jetzt: number): KontingentErgebnis {
  const tag = tagesschluessel(jetzt);
  const kennung = kennungFuer(salzFuer(db, tag), ip);

  const bisherPerson = standFuer(db, tag, kennung);
  const bisherGesamt = standFuer(db, tag, GESAMT);
  if (verbleibend(bisherPerson, bisherGesamt) <= 0) {
    return { erlaubt: false, verbleibend: 0 };
  }

  erhoehe(db, tag, kennung);
  erhoehe(db, tag, GESAMT);
  return {
    erlaubt: true,
    verbleibend: verbleibend(bisherPerson + 1, bisherGesamt + 1),
  };
}
