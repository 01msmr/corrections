import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { corrections, errorTypes, outlets, responseEvents } from "../db/schema.js";
import { seed } from "../db/seed.js";
import { createOutlet } from "./outlets.js";
import {
  ladeAntwortKandidaten,
  listeBestaetigungen,
  macheAuszuegeLesbar,
  nimmBestaetigungenZurueck,
  vermerkeAntwort,
  zaehleBestaetigungen,
} from "./antworten.js";

const JETZT = 1_800_000_000;

let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  seed(db);
  createOutlet(
    db,
    {
      name: "Alpha-Blatt",
      primaryDomain: "alpha-blatt.de",
      publisher: null,
      country: null,
      notes: null,
      contactEmails: [],
    },
    JETZT,
  );
});

function meldung(overrides: Partial<typeof corrections.$inferInsert> = {}): string {
  const id = createId();
  const outletId = db.select().from(outlets).all()[0]?.id;
  const errorTypeId = db.select().from(errorTypes).all()[0]?.id;
  if (!outletId || !errorTypeId) throw new Error("Stammdaten fehlen");
  db.insert(corrections)
    .values({
      id,
      ref: `K${id.slice(0, 5).toUpperCase()}`,
      idempotencyKey: id,
      createdAt: JETZT,
      dispatchMode: "smtp",
      articleUrl: "https://alpha-blatt.de/a",
      articleUrlCanon: "https://alpha-blatt.de/a",
      outletId,
      errorTypeId,
      severity: 2,
      quoteBefore: "falsch",
      suggestionAfter: "richtig",
      recipientEmail: "korrektur@alpha-blatt.de",
      dispatchStatus: "sent",
      sentAt: JETZT,
      source: "backfill",
      headline: "Kann die Bahn ihn wiederbeleben?",
      messageId: "<abc123@korrekturen.msmr.co>",
      ...overrides,
    })
    .run();
  return id;
}

describe("ladeAntwortKandidaten", () => {
  it("liefert Kennung, blanke Message-ID, normierten Titel und Domains", () => {
    meldung();
    const [kandidat] = ladeAntwortKandidaten(db);
    expect(kandidat?.messageId).toBe("abc123@korrekturen.msmr.co");
    expect(kandidat?.headlineNorm).toBe("kann die bahn ihn wiederbeleben?");
    expect(kandidat?.domains).toContain("alpha-blatt.de");
  });
});

describe("vermerkeAntwort", () => {
  const VERMERK = {
    receivedAt: JETZT + 500,
    rawMessageId: "antwort-1@alpha-blatt.de",
    fromAddr: "redaktion@alpha-blatt.de",
    excerpt: "Danke, wir haben es korrigiert.",
  };

  it("haelt die Antwort fest und stellt offene Meldungen auf Antwort erhalten", () => {
    const id = meldung();
    expect(vermerkeAntwort(db, id, VERMERK)).toBe(true);

    const zeile = db.select().from(corrections).all()[0];
    expect(zeile?.outcome).toBe("acknowledged");
    expect(zeile?.respondedAt).toBe(JETZT + 500);
    expect(db.select().from(responseEvents).all()).toHaveLength(1);
  });

  it("ist ueber die Message-ID idempotent", () => {
    const id = meldung();
    expect(vermerkeAntwort(db, id, VERMERK)).toBe(true);
    expect(vermerkeAntwort(db, id, VERMERK)).toBe(false);
    expect(db.select().from(responseEvents).all()).toHaveLength(1);
  });

  it("laesst einen gesetzten Ausgang unangetastet", () => {
    /* Was aus der Antwort folgt, entscheidet der Betreiber — eine spaeter
       eintreffende Mail darf "korrigiert" nicht zuruecksetzen. */
    const id = meldung({ outcome: "corrected", respondedAt: JETZT + 100 });
    expect(vermerkeAntwort(db, id, { ...VERMERK, rawMessageId: "antwort-2@alpha-blatt.de" })).toBe(true);
    const zeile = db.select().from(corrections).all()[0];
    expect(zeile?.outcome).toBe("corrected");
    expect(zeile?.respondedAt).toBe(JETZT + 100);
    expect(db.select().from(responseEvents).all()).toHaveLength(1);
  });
});

/* Eingangsbestaetigungen, die als Antwort gezaehlt wurden, weil die Erkennung
   ihre Formulierung noch nicht kannte (Fund vom 14.8.2026). */
describe("Bestaetigungen zuruecknehmen", () => {
  const passt = (text: string): boolean => text.toLowerCase().includes("sichten und bearbeiten wir");

  it("zaehlt sie, ohne etwas zu aendern", () => {
    const id = meldung();
    vermerkeAntwort(db, id, {
      receivedAt: JETZT,
      rawMessageId: "bestaetigung@spiegel.de",
      fromAddr: "leserservice@spiegel.de",
      excerpt: "Gern sichten und bearbeiten wir Ihren Hinweis.",
    });
    expect(zaehleBestaetigungen(db, passt)).toEqual({ ereignisse: 1, meldungen: 1 });
    expect(db.select().from(responseEvents).all()).toHaveLength(1);
  });

  /* Vor dem Loeschen sichten: die Entscheidung faellt am Wortlaut. */
  it("legt dieselben Treffer mit Kennung und Wortlaut vor", () => {
    const id = meldung();
    vermerkeAntwort(db, id, {
      receivedAt: JETZT,
      rawMessageId: "sicht-1",
      fromAddr: "leserservice@spiegel.de",
      excerpt: "Gern sichten und bearbeiten wir Ihren Hinweis.",
    });
    const liste = listeBestaetigungen(db, passt);
    expect(liste).toHaveLength(1);
    expect(liste[0]?.correctionId).toBe(id);
    expect(liste[0]?.excerpt).toContain("Gern sichten");
    expect(liste[0]?.outcomeVorher).toBe("acknowledged");
    expect(db.select().from(responseEvents).all()).toHaveLength(1);
  });

  it("loescht das Ereignis und stellt den offenen Ausgang wieder her", () => {
    const id = meldung();
    vermerkeAntwort(db, id, {
      receivedAt: JETZT,
      rawMessageId: "bestaetigung@spiegel.de",
      fromAddr: "leserservice@spiegel.de",
      excerpt: "Gern sichten und bearbeiten wir Ihren Hinweis.",
    });
    const weg = nimmBestaetigungenZurueck(db, passt);
    expect(weg.geloescht).toBe(1);
    expect(weg.wiederOffen).toBe(1);
    /* Weggeschrieben, bevor geloescht wird: das Netz unter dem Eingriff. */
    expect(weg.zeilen[0]?.rawMessageId).toBe("bestaetigung@spiegel.de");
    expect(weg.zeilen[0]?.outcomeVorher).toBe("acknowledged");

    expect(db.select().from(responseEvents).all()).toHaveLength(0);
    const zeile = db.select().from(corrections).all()[0];
    expect(zeile?.outcome).toBe("open");
    expect(zeile?.respondedAt).toBeNull();
  });

  it("laesst eine Meldung in Ruhe, die auch eine echte Antwort hat", () => {
    const id = meldung();
    vermerkeAntwort(db, id, {
      receivedAt: JETZT,
      rawMessageId: "bestaetigung@spiegel.de",
      fromAddr: "leserservice@spiegel.de",
      excerpt: "Gern sichten und bearbeiten wir Ihren Hinweis.",
    });
    vermerkeAntwort(db, id, {
      receivedAt: JETZT + 60,
      rawMessageId: "echt@spiegel.de",
      fromAddr: "leserservice@spiegel.de",
      excerpt: "Wir haben die Stelle korrigiert.",
    });
    expect(nimmBestaetigungenZurueck(db, passt)).toMatchObject({ geloescht: 1, wiederOffen: 0 });
    expect(db.select().from(corrections).all()[0]?.outcome).toBe("acknowledged");
  });
});

/* Die Auszuege der ersten Laeufe stehen roh in der Historie: Grenzmarken,
   Kopfzeilen, base64. Sie lassen sich nachtraeglich lesbar machen, ohne das
   Postfach noch einmal zu lesen (Fund vom 14.8.2026). */
describe("Auszuege lesbar machen", () => {
  it("dekodiert einen base64-Auszug und ruehrt lesbare nicht an", () => {
    const roh = meldung();
    vermerkeAntwort(db, roh, {
      receivedAt: JETZT,
      rawMessageId: "roh@example.tld",
      fromAddr: "redaktion@example.tld",
      excerpt:
        '--grenze\nContent-Type: text/plain; charset="utf-8"\nContent-Transfer-Encoding: base64\n\n' +
        "RGFua2UsIHdpciBoYWJlbiBrb3JyaWdpZXJ0Lg==",
    });
    const lesbar = meldung();
    vermerkeAntwort(db, lesbar, {
      receivedAt: JETZT,
      rawMessageId: "lesbar@example.tld",
      fromAddr: "redaktion@example.tld",
      excerpt: "Danke, wir haben korrigiert.",
    });

    expect(macheAuszuegeLesbar(db)).toBe(1);
    const auszuege = db
      .select()
      .from(responseEvents)
      .all()
      .map((z) => z.excerpt);
    expect(auszuege).toContain("Danke, wir haben korrigiert.");
    expect(auszuege.filter((a) => a === "Danke, wir haben korrigiert.")).toHaveLength(2);
  });
});
