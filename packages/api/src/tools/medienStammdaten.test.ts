import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { outletDomains, outlets } from "../db/schema.js";
import { createOutlet } from "../repo/outlets.js";
import { uebernimmStammdaten } from "./medienStammdaten.js";

const NOW = 1_800_000_000;
let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
});

function medium(name: string, domain: string, mails: string[] = []) {
  return createOutlet(
    db,
    { name, primaryDomain: domain, publisher: null, country: null, notes: null, contactEmails: mails },
    NOW,
  );
}

describe("uebernimmStammdaten", () => {
  it("legt ein Medium an, das noch keine Meldung hat", () => {
    const ergebnis = uebernimmStammdaten(
      db,
      { nw: { RedNAME: "NW", RedMAIL: "digitalredaktion@nw.de" } },
      NOW,
    );
    expect(ergebnis.angelegt).toBe(1);

    const angelegt = db.select().from(outlets).all()[0];
    expect(angelegt?.name).toBe("NW");
    expect(angelegt?.primaryDomain).toBe("nw.de");
    expect(angelegt?.contactEmails).toEqual(["digitalredaktion@nw.de"]);
    expect(db.select().from(outletDomains).all()[0]?.domain).toBe("nw.de");
  });

  it("ersetzt abgeleiteten Namen und veraltete Adresse", () => {
    // So sieht ein automatisch angelegtes Medium aus: Name = Domain.
    medium("manager-magazin.de", "manager-magazin.de", ["redaktion@manager-magazin.de"]);

    const ergebnis = uebernimmStammdaten(
      db,
      {
        "manager-magazin": {
          RedNAME: "manager-magazin",
          RedMAIL: "mm.digitaldesk@manager-magazin.de",
        },
      },
      NOW,
    );
    expect(ergebnis.aktualisiert).toBe(1);

    const zeile = db.select().from(outlets).all()[0];
    expect(zeile?.name).toBe("manager-magazin");
    expect(zeile?.contactEmails).toEqual(["mm.digitaldesk@manager-magazin.de"]);
  });

  it("meldet Unveraendertes, statt sinnlos zu schreiben", () => {
    medium("SPIEGEL", "spiegel.de", ["redaktion@spiegel.de"]);
    const ergebnis = uebernimmStammdaten(
      db,
      { spiegel: { RedNAME: "SPIEGEL", RedMAIL: "redaktion@spiegel.de" } },
      NOW,
    );
    expect(ergebnis).toEqual({ angelegt: 0, aktualisiert: 0, unveraendert: 1, fehler: [] });
  });

  it("findet das Medium ueber eine Zusatzdomain", () => {
    const outlet = medium("Süddeutsche", "sueddeutsche.de", []);
    db.insert(outletDomains)
      .values({ id: "extra", outletId: outlet.id, domain: "sz.de" })
      .run();

    uebernimmStammdaten(db, { "sz.de": { RedMAIL: "fehler@sz.de" } }, NOW);
    expect(db.select().from(outlets).all()[0]?.contactEmails).toEqual(["fehler@sz.de"]);
    // Kein zweites Medium fuer dieselbe Domain.
    expect(db.select().from(outlets).all()).toHaveLength(1);
  });

  it("meldet einen Eintrag ohne Angaben", () => {
    const ergebnis = uebernimmStammdaten(db, { leer: {} }, NOW);
    expect(ergebnis.fehler).toHaveLength(1);
    expect(db.select().from(outlets).all()).toHaveLength(0);
  });
});
