import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { errorTypes, outletDomains, outlets } from "./schema.js";

/**
 * Die zwoelf Ausgangswerte aus §5.0, dazu "wortwahl".
 *
 * Der urspruengliche Kurzbefehl kannte zehn Fehlerarten, die den Eingriff am
 * Text benennen ("ein Komma fehlt") statt der Kategorie ("Zeichensetzung").
 * Neun davon gehen in den vorhandenen auf: Zeichen und Buchstabendreher in
 * `rechtschreibung`, Komma in `zeichensetzung`, fehlendes/ueberzaehliges Wort
 * und Satzbau in `grammatik`, Inhaltsfehler in `faktenfehler`. Nur "falsche
 * Wortwahl" hatte keine Entsprechung und ist deshalb als einzige neu.
 *
 * Weitere werden ueber das Adminformular gepflegt.
 */
export const DEFAULT_ERROR_TYPES = [
  { key: "rechtschreibung", label: "Rechtschreibung", description: "Falsch geschriebenes Wort." },
  { key: "grammatik", label: "Grammatik", description: "Fehlerhafter Satzbau oder Beugung." },
  { key: "zeichensetzung", label: "Zeichensetzung", description: "Komma, Punkt, Anführungszeichen." },
  { key: "zahl", label: "Zahl", description: "Falsche Zahl, Einheit oder Größenordnung." },
  { key: "datum", label: "Datum", description: "Falsches Datum, Jahr oder Zeitangabe." },
  { key: "name", label: "Name", description: "Falsch geschriebener oder verwechselter Name." },
  { key: "faktenfehler", label: "Faktenfehler", description: "Sachlich unzutreffende Aussage." },
  { key: "falschzitat", label: "Falschzitat", description: "Zitat unzutreffend oder sinnentstellend." },
  { key: "uebersetzung", label: "Übersetzung", description: "Fehlerhafte Übertragung aus einer Fremdsprache." },
  { key: "bild", label: "Bild", description: "Falsche Bildunterschrift oder unpassendes Bild." },
  { key: "ueberschrift_deckt_nicht", label: "Überschrift deckt nicht", description: "Überschrift wird vom Text nicht getragen." },
  { key: "sonstiges", label: "Sonstiges", description: "Passt in keine der übrigen Kategorien." },
  { key: "wortwahl", label: "Wortwahl", description: "Das gewählte Wort trifft die gemeinte Bedeutung nicht." },
] as const;

const DEFAULT_OUTLETS = [
  { name: "Beispiel-Zeitung", domain: "beispiel-zeitung.de", publisher: "Beispiel Verlag" },
  { name: "Muster-Magazin", domain: "muster-magazin.de", publisher: "Muster Medien" },
  { name: "Probe-Anzeiger", domain: "probe-anzeiger.de", publisher: "Probe Presse" },
] as const;

export function seed(db: Db): void {
  const now = Math.floor(Date.now() / 1000);

  DEFAULT_ERROR_TYPES.forEach((entry, index) => {
    const existing = db.select().from(errorTypes).where(eq(errorTypes.key, entry.key)).get();
    if (existing) return;
    db.insert(errorTypes)
      .values({
        id: createId(),
        key: entry.key,
        label: entry.label,
        description: entry.description,
        sortOrder: (index + 1) * 10,
        createdAt: now,
      })
      .run();
  });

  for (const entry of DEFAULT_OUTLETS) {
    const existing = db
      .select()
      .from(outletDomains)
      .where(eq(outletDomains.domain, entry.domain))
      .get();
    if (existing) continue;

    const outletId = createId();
    db.insert(outlets)
      .values({
        id: outletId,
        name: entry.name,
        primaryDomain: entry.domain,
        publisher: entry.publisher,
        country: "DE",
        contactEmails: [],
        createdAt: now,
      })
      .run();
    db.insert(outletDomains).values({ id: createId(), outletId, domain: entry.domain }).run();
  }
}
