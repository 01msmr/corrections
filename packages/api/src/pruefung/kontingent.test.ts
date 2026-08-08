import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { pruefKontingent, pruefSalz } from "../db/schema.js";
import {
  BESUCHER_PRO_TAG,
  bucheBesucherPruefung,
  TAGESGRENZE,
  tagesschluessel,
  verbleibend,
} from "./kontingent.js";

const JETZT = 1_800_000_000; // 2027-01-15 in UTC
const MORGEN = JETZT + 86_400;

let db: Db;
beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
});

describe("verbleibend", () => {
  it("gibt zwei Pruefungen, solange der Tag nicht knapp ist", () => {
    expect(verbleibend(0, 0)).toBe(BESUCHER_PRO_TAG);
    expect(verbleibend(1, 5)).toBe(1);
    expect(verbleibend(2, 5)).toBe(0);
  });

  it("kuerzt auf eine, sobald die Tagesgrenze erreicht ist", () => {
    expect(verbleibend(0, TAGESGRENZE)).toBe(1);
    expect(verbleibend(1, TAGESGRENZE)).toBe(0);
    // Wer sein zweites Kontingent schon verbraucht hat, bekommt nichts nach.
    expect(verbleibend(2, TAGESGRENZE)).toBe(0);
  });
});

describe("bucheBesucherPruefung", () => {
  it("laesst zwei Pruefungen zu und lehnt die dritte ab", () => {
    expect(bucheBesucherPruefung(db, "203.0.113.7", JETZT)).toEqual({
      erlaubt: true,
      verbleibend: 1,
    });
    expect(bucheBesucherPruefung(db, "203.0.113.7", JETZT)).toEqual({
      erlaubt: true,
      verbleibend: 0,
    });
    expect(bucheBesucherPruefung(db, "203.0.113.7", JETZT).erlaubt).toBe(false);
  });

  it("zaehlt Personen getrennt", () => {
    bucheBesucherPruefung(db, "203.0.113.7", JETZT);
    bucheBesucherPruefung(db, "203.0.113.7", JETZT);
    expect(bucheBesucherPruefung(db, "198.51.100.4", JETZT).erlaubt).toBe(true);
  });

  it("kuerzt alle auf eine Pruefung, sobald die Tagesgrenze voll ist", () => {
    for (let i = 0; i < TAGESGRENZE / 2; i++) {
      const ip = `203.0.113.${i}`;
      bucheBesucherPruefung(db, ip, JETZT);
      bucheBesucherPruefung(db, ip, JETZT);
    }
    const frisch = "198.51.100.9";
    expect(bucheBesucherPruefung(db, frisch, JETZT)).toEqual({ erlaubt: true, verbleibend: 0 });
    expect(bucheBesucherPruefung(db, frisch, JETZT).erlaubt).toBe(false);
  });

  it("speichert keine IP, sondern einen Hash", () => {
    bucheBesucherPruefung(db, "203.0.113.7", JETZT);
    const zeilen = db.select().from(pruefKontingent).all();
    for (const zeile of zeilen) {
      expect(zeile.kennung).not.toContain("203.0.113.7");
    }
    expect(zeilen.map((z) => z.kennung)).toContain("#gesamt");
  });

  it("beginnt am naechsten Tag von vorn und raeumt den Vortag weg", () => {
    bucheBesucherPruefung(db, "203.0.113.7", JETZT);
    bucheBesucherPruefung(db, "203.0.113.7", JETZT);
    expect(bucheBesucherPruefung(db, "203.0.113.7", JETZT).erlaubt).toBe(false);

    expect(bucheBesucherPruefung(db, "203.0.113.7", MORGEN).erlaubt).toBe(true);
    // Vortag ist fort — mit seinem Salz waere die Zaehlung ohnehin wertlos.
    const tage = new Set(db.select().from(pruefKontingent).all().map((z) => z.tag));
    expect([...tage]).toEqual([tagesschluessel(MORGEN)]);
    expect(db.select().from(pruefSalz).all()).toHaveLength(1);
  });

  it("wechselt das Salz mit dem Tag", () => {
    bucheBesucherPruefung(db, "203.0.113.7", JETZT);
    const salzHeute = db.select().from(pruefSalz).all()[0]?.salz;
    bucheBesucherPruefung(db, "203.0.113.7", MORGEN);
    const salzMorgen = db.select().from(pruefSalz).all()[0]?.salz;
    expect(salzMorgen).not.toBe(salzHeute);
  });
});
