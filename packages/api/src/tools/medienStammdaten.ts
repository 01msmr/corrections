import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { outletDomains, outlets } from "../db/schema.js";

/**
 * Übernimmt die Redaktionsangaben aus dem Wörterbuch des iOS-Kurzbefehls.
 * Dort steht je Medium ein Eintrag mit `RedNAME` und `RedMAIL` — die
 * gepflegte Fassung, an der der Versand jahrelang hing. Sie schlägt deshalb
 * abgeleitete Angaben: Der Kurzbefehl kennt auch Medien, zu denen noch keine
 * Meldung erfasst ist, und die aktuelle Adresse selbst dann, wenn die letzte
 * Mail noch an die alte ging.
 *
 * Erwartetes Format (JSON-Export des Wörterbuchs):
 *   { "spiegel": { "RedNAME": "SPIEGEL", "RedMAIL": "redaktion@spiegel.de" } }
 *
 * Die Datei liegt in `fixtures.local/` und damit außerhalb des Repositories
 * (§CLAUDE.md: keine echten Adressen committen).
 */

export interface KurzbefehlEintrag {
  RedNAME?: string;
  RedMAIL?: string;
  /** Optional, falls der Schlüssel nicht der Domain ohne Endung entspricht. */
  Domain?: string;
}

export interface StammdatenErgebnis {
  angelegt: number;
  aktualisiert: number;
  unveraendert: number;
  fehler: string[];
}

/**
 * Leitet die Domain ab: bevorzugt aus dem Eintrag selbst, sonst aus dem
 * Schlüssel plus `.de`. Enthält der Schlüssel schon einen Punkt, gilt er als
 * vollständige Domain.
 */
function domainZu(schluessel: string, eintrag: KurzbefehlEintrag): string {
  if (eintrag.Domain) return eintrag.Domain.toLowerCase();
  return schluessel.includes(".") ? schluessel.toLowerCase() : `${schluessel.toLowerCase()}.de`;
}

export function uebernimmStammdaten(
  db: Db,
  woerterbuch: Record<string, KurzbefehlEintrag>,
  now: number,
): StammdatenErgebnis {
  const ergebnis: StammdatenErgebnis = { angelegt: 0, aktualisiert: 0, unveraendert: 0, fehler: [] };

  for (const [schluessel, eintrag] of Object.entries(woerterbuch)) {
    const domain = domainZu(schluessel, eintrag);
    const name = eintrag.RedNAME?.trim();
    const mail = eintrag.RedMAIL?.trim();
    if (!name && !mail) {
      ergebnis.fehler.push(`${schluessel}: weder Name noch Adresse`);
      continue;
    }

    const zuordnung = db
      .select()
      .from(outletDomains)
      .where(eq(outletDomains.domain, domain))
      .get();

    if (!zuordnung) {
      /* Medium, zu dem es noch keine Meldung gibt — der Kurzbefehl kennt es
         trotzdem, also wird es angelegt. */
      const id = createId();
      db.insert(outlets)
        .values({
          id,
          name: name ?? domain,
          primaryDomain: domain,
          country: "DE",
          contactEmails: mail ? [mail] : [],
          createdAt: now,
        })
        .run();
      db.insert(outletDomains).values({ id: createId(), outletId: id, domain }).run();
      ergebnis.angelegt += 1;
      continue;
    }

    const vorhanden = db.select().from(outlets).where(eq(outlets.id, zuordnung.outletId)).get();
    if (!vorhanden) {
      ergebnis.fehler.push(`${schluessel}: Zuordnung ohne Medium`);
      continue;
    }

    /* Der Kurzbefehl ist die gepflegte Quelle: Sein Name ersetzt einen aus
       der Domain abgeleiteten, seine Adresse die zuletzt benutzte. */
    const neuerName = name && name !== vorhanden.name ? name : null;
    const neueMail =
      mail && (vorhanden.contactEmails[0] !== mail || vorhanden.contactEmails.length !== 1)
        ? [mail]
        : null;

    if (!neuerName && !neueMail) {
      ergebnis.unveraendert += 1;
      continue;
    }

    db.update(outlets)
      .set({
        ...(neuerName ? { name: neuerName } : {}),
        ...(neueMail ? { contactEmails: neueMail } : {}),
      })
      .where(eq(outlets.id, vorhanden.id))
      .run();
    ergebnis.aktualisiert += 1;
  }

  return ergebnis;
}
