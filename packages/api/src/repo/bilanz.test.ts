import { MATURITY_SECONDS } from "@korrektur/shared";
import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { articleChecks, corrections, errorTypes, imapCursor, outlets, responseEvents } from "../db/schema.js";
import { seed } from "../db/seed.js";
import { ladeBilanz, segmentiere, UEBRIGE_NAME } from "./bilanz.js";
import { createOutlet } from "./outlets.js";

const JETZT = 1_800_000_000;
/** Deutlich älter als die Reifegrenze, damit die Meldung in die Nenner zählt. */
const ALT = JETZT - MATURITY_SECONDS - 86_400;

let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  seed(db);
  /* seed() saet nur Fehlerarten; die Tests brauchen bis zu drei Medien. */
  for (const [name, domain] of [
    ["Beispiel-Zeitung", "beispiel-zeitung.de"],
    ["Muster-Magazin", "muster-magazin.de"],
    ["Probe-Anzeiger", "probe-anzeiger.de"],
  ] as const) {
    createOutlet(
      db,
      { name, primaryDomain: domain, publisher: null, country: null, notes: null, contactEmails: [] },
      ALT,
    );
  }
});

function ersteFehlerart(): string {
  const zeile = db.select().from(errorTypes).all()[0];
  if (!zeile) throw new Error("Seed ohne Fehlerarten");
  return zeile.id;
}

function ersteMedien(anzahl: number): string[] {
  return db
    .select()
    .from(outlets)
    .all()
    .slice(0, anzahl)
    .map((zeile) => zeile.id);
}

function meldung(overrides: Partial<typeof corrections.$inferInsert> = {}): string {
  const id = createId();
  const outletId = ersteMedien(1)[0];
  if (!outletId) throw new Error("Seed ohne Medien");
  db.insert(corrections)
    .values({
      id,
      ref: `K${id.slice(0, 5).toUpperCase()}`,
      idempotencyKey: id,
      createdAt: ALT,
      dispatchMode: "smtp",
      articleUrl: "https://beispiel-zeitung.de/a",
      articleUrlCanon: "https://beispiel-zeitung.de/a",
      outletId,
      errorTypeId: ersteFehlerart(),
      severity: 2,
      quoteBefore: "falsch",
      suggestionAfter: "richtig",
      recipientEmail: "korrektur@beispiel-zeitung.de",
      dispatchStatus: "sent",
      sentAt: ALT,
      source: "backfill",
      ...overrides,
    })
    .run();
  return id;
}

/** Vermerkt eine Artikel-Pruefung — erst dann zaehlt die Meldung in den
 *  Korrektur-Nenner (§9.3 "pruefbar"). */
function gepruef(correctionId: string, quoteState: "unchanged" | "changed_as_suggested" = "unchanged"): void {
  db.insert(articleChecks)
    .values({ id: createId(), correctionId, checkedAt: ALT + 200, quoteState })
    .run();
}

/** Vermerkt, dass ein Postfach-Abgleich gelaufen ist. */
function abgleichGelaufen(): void {
  db.insert(imapCursor).values({ folder: "INBOX", uidvalidity: 1, lastUid: 42 }).run();
}

describe("ladeBilanz", () => {
  it("liefert bei leerem Bestand Nullen statt Fehlern", () => {
    const bilanz = ladeBilanz(db, JETZT);
    expect(bilanz.meldungen).toBe(0);
    expect(bilanz.medien).toBe(0);
    expect(bilanz.von).toBeNull();
    expect(bilanz.korrektur).toEqual({ zaehler: 0, nenner: 0 });
    expect(bilanz.fehlerarten).toEqual([]);
    expect(bilanz.verlauf).toEqual([]);
  });

  it("zaehlt Meldungen, Medien und den Zeitraum", () => {
    const [erstes, zweites] = ersteMedien(2);
    meldung({ sentAt: ALT, createdAt: ALT });
    meldung({ outletId: zweites, sentAt: ALT + 1000, createdAt: ALT + 1000 });
    if (!erstes) throw new Error("Seed ohne Medien");

    const bilanz = ladeBilanz(db, JETZT);
    expect(bilanz.meldungen).toBe(2);
    expect(bilanz.medien).toBe(2);
    expect(bilanz.von).toBe(ALT);
    expect(bilanz.bis).toBe(ALT + 1000);
  });

  it("nimmt frische und nicht zugestellte Meldungen aus den Quoten-Nennern", () => {
    const reif = meldung(); // reif und zugestellt
    const frisch = meldung({ sentAt: JETZT - 60, createdAt: JETZT - 60 });
    const gescheitert = meldung({ dispatchStatus: "failed", sentAt: null });
    // Alle drei geprueft — ausschlaggebend sind Reife und Zustellbarkeit.
    for (const id of [reif, frisch, gescheitert]) gepruef(id);

    const bilanz = ladeBilanz(db, JETZT);
    expect(bilanz.meldungen).toBe(3);
    expect(bilanz.reifUndZustellbar).toBe(1);
    expect(bilanz.korrektur.nenner).toBe(1);
  });

  it("laesst ungepruefte Meldungen aus dem Korrektur-Nenner — sie sind nicht 'nicht korrigiert'", () => {
    meldung();
    meldung();

    const bilanz = ladeBilanz(db, JETZT);
    expect(bilanz.reifUndZustellbar).toBe(2);
    // Kein Artikel-Check: der Nenner bleibt leer, statt 0 % zu behaupten.
    expect(bilanz.korrektur).toEqual({ zaehler: 0, nenner: 0 });
  });

  it("zaehlt eine bestaetigte Korrektur nur bei manueller Pruefung", () => {
    gepruef(meldung({ correctedAt: ALT + 100, verification: "manual" }));
    gepruef(meldung({ correctedAt: ALT + 100, verification: "none" }));

    const bilanz = ladeBilanz(db, JETZT);
    expect(bilanz.korrektur).toEqual({ zaehler: 1, nenner: 2 });
  });

  it("haelt den Antwort-Nenner leer, solange kein Postfach-Abgleich lief", () => {
    meldung();
    meldung();
    expect(ladeBilanz(db, JETZT).antwort).toEqual({ zaehler: 0, nenner: 0 });
  });

  it("zaehlt eine Antwort nur bei kind='reply'", () => {
    abgleichGelaufen();
    const mitAntwort = meldung();
    const mitAutoreply = meldung();
    db.insert(responseEvents)
      .values({ id: createId(), correctionId: mitAntwort, kind: "reply", receivedAt: ALT + 500 })
      .run();
    db.insert(responseEvents)
      .values({ id: createId(), correctionId: mitAutoreply, kind: "autoreply", receivedAt: ALT + 500 })
      .run();

    const bilanz = ladeBilanz(db, JETZT);
    expect(bilanz.antwort).toEqual({ zaehler: 1, nenner: 2 });
  });

  it("sortiert Medien alphabetisch, nicht nach Anzahl", () => {
    const [erstes, zweites, drittes] = ersteMedien(3);
    if (!erstes || !zweites || !drittes) throw new Error("Seed ohne drei Medien");
    // Das Medium mit den meisten Meldungen steht alphabetisch vorn — die
    // Sortierung darf sich davon nicht beeindrucken lassen.
    meldung({ outletId: drittes });
    meldung({ outletId: zweites });
    meldung({ outletId: zweites });

    const namen = ladeBilanz(db, JETZT).medienListe.map((eintrag) => eintrag.name);
    expect(namen).toEqual([...namen].sort((a, b) => a.localeCompare(b)));
  });

  it("gruppiert den Verlauf nach Monaten", () => {
    const januar = Math.floor(Date.UTC(2026, 0, 15) / 1000);
    const februar = Math.floor(Date.UTC(2026, 1, 3) / 1000);
    meldung({ sentAt: januar, createdAt: januar });
    meldung({ sentAt: februar, createdAt: februar });
    meldung({ sentAt: februar + 100, createdAt: februar + 100 });

    expect(ladeBilanz(db, JETZT).verlauf).toEqual([
      { monat: "2026-01", anzahl: 1 },
      { monat: "2026-02", anzahl: 2 },
    ]);
  });

  it("fuellt Monate ohne Meldung mit Null, damit die Zeitachse stimmt", () => {
    const november = Math.floor(Date.UTC(2025, 10, 4) / 1000);
    const februar = Math.floor(Date.UTC(2026, 1, 4) / 1000);
    meldung({ sentAt: november, createdAt: november });
    meldung({ sentAt: februar, createdAt: februar });

    expect(ladeBilanz(db, JETZT).verlauf).toEqual([
      { monat: "2025-11", anzahl: 1 },
      { monat: "2025-12", anzahl: 0 },
      { monat: "2026-01", anzahl: 0 },
      { monat: "2026-02", anzahl: 1 },
    ]);
  });

  it("benennt die Schwere in Worten", () => {
    meldung({ severity: 1 });
    meldung({ severity: 3 });
    expect(ladeBilanz(db, JETZT).schwere).toEqual([
      { name: "kosmetisch", anzahl: 1 },
      { name: "sinnentstellend", anzahl: 1 },
    ]);
  });
});

describe("segmentiere", () => {
  const medien = (paare: [string, number][]) => paare.map(([name, anzahl]) => ({ name, anzahl }));

  it("bildet Segmente ab 15 % und 3 Stueck, alphabetisch, Rest als uebrige", () => {
    // n=20: Schwelle ist max(3, 3) = 3
    const teile = segmentiere(20, medien([["taz", 8], ["FAZ", 5], ["Zeit", 2], ["Welt", 5]]));
    // de-Collation ordnet nach Basisbuchstaben: FAZ < taz < Welt (Gross/Klein egal).
    expect(teile.map((t) => t.name)).toEqual(["FAZ", "taz", "Welt", UEBRIGE_NAME]);
    expect(teile.map((t) => t.anzahl)).toEqual([5, 8, 5, 2]);
  });

  it("verlangt beide Schwellen: 2 von 4 sind 50 %, aber unter 3 Stueck", () => {
    expect(segmentiere(4, medien([["taz", 2], ["FAZ", 2]]))).toEqual([]);
  });

  it("laesst uebrige weg, wenn alle Medien qualifiziert sind", () => {
    const teile = segmentiere(10, medien([["taz", 7], ["FAZ", 3]]));
    expect(teile.map((t) => t.name)).toEqual(["FAZ", "taz"]);
  });

  it("bleibt bei kleinem n leer statt scheingenau", () => {
    expect(segmentiere(1, medien([["taz", 1]]))).toEqual([]);
  });
});

describe("beteiligte in ladeBilanz", () => {
  it("haengt Segmente an die Fehlerarten, nicht an die Schwere", () => {
    const [erstes] = ersteMedien(1);
    if (!erstes) throw new Error("Testmedien fehlen");
    for (let i = 0; i < 3; i++) meldung({ outletId: erstes });
    const bilanz = ladeBilanz(db, JETZT);
    const fehlerart = bilanz.fehlerarten[0];
    // Beispiel-Zeitung traegt alle 3 — ein Segment, kein "uebrige".
    expect(fehlerart?.beteiligte).toEqual([{ name: "Beispiel-Zeitung", anzahl: 3 }]);
    expect(bilanz.schwere[0]?.beteiligte).toBeUndefined();
  });
});

describe("weiche Kategorien", () => {
  /** Eine Meldung der weichen Kategorie "schlechter Satzbau". */
  function weicheMeldung(): void {
    const zeile = db.select().from(errorTypes).all().find((t) => t.key === "schlechter_satzbau");
    if (!zeile) throw new Error("Fehlerart schlechter_satzbau fehlt");
    meldung({ errorTypeId: zeile.id });
  }

  it("laesst weiche Kategorien in der Vorgabe aus allen Zahlen heraus", () => {
    meldung();
    weicheMeldung();
    weicheMeldung();

    const ohne = ladeBilanz(db, JETZT);
    expect(ohne.meldungen).toBe(1);
    expect(ohne.fehlerarten.map((f) => f.name)).not.toContain("schlechter Satzbau");
    expect(ohne.medienListe[0]?.anzahl).toBe(1);

    const mit = ladeBilanz(db, JETZT, { mitWeichen: true });
    expect(mit.meldungen).toBe(3);
    expect(mit.fehlerarten.map((f) => f.name)).toContain("schlechter Satzbau");
  });
});
