import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { errorTypes, outletDomains, outlets } from "./schema.js";

/**
 * Die Fehlerarten des urspruenglichen Kurzbefehls, ergaenzt um einige, die dort
 * fehlten. Die Bezeichnungen benennen den Eingriff am Text ("ein Komma fehlt"),
 * nicht die Kategorie ("Zeichensetzung") -- so stand es im Kurzbefehl, aus dem
 * diese Anwendung entstanden ist, und so waehlt es sich schneller.
 * Weitere werden ueber das Adminformular gepflegt.
 */
export const DEFAULT_ERROR_TYPES = [
  /* Grundformen ohne Anzahl im Namen: die Erkennung zaehlt selbst, und die
     Benennung einer konkreten Meldung fuegt Anzahl und Form sprachlich
     zusammen ("2 Zeichen fehlen", siehe benenneFehlerart in shared). Die
     Schluessel bleiben die alten, damit Datensaetze weiter darauf zeigen. */
  { key: "zeichen_fehlt", label: "Zeichen fehlen", description: "Anzahl frei — wird automatisch mitgezählt." },
  { key: "zeichen_zu_viel", label: "Zeichen zu viel", description: "Anzahl frei — wird automatisch mitgezählt." },
  { key: "leerzeichen_fehlt", label: "Leerzeichen fehlen", description: "Zusammengeschriebenes gehört getrennt; Anzahl frei." },
  { key: "leerzeichen_zu_viel", label: "Leerzeichen zu viel", description: "Getrenntes gehört zusammen; Anzahl frei." },
  { key: "buchstabendreher", label: "ein Buchstabendreher", description: "" },
  { key: "komma_fehlt", label: "Satzzeichen fehlen", description: "Komma, Punkt oder anderes Satzzeichen; Anzahl frei." },
  { key: "komma_zu_viel", label: "Satzzeichen zu viel", description: "Anzahl frei — wird automatisch mitgezählt." },
  { key: "wort_fehlt", label: "Wörter fehlen", description: "Anzahl frei — wird automatisch mitgezählt." },
  { key: "wort_zu_viel", label: "Wörter zu viel", description: "Anzahl frei — wird automatisch mitgezählt." },
  { key: "falsche_wortwahl", label: "falsche Wortwahl", description: "" },
  /* Zwei getrennte Satzbau-Faelle: falsch (grammatisch kaputt) und schlecht
     (verstaendlich, aber holprig) — der Schluessel satzbau bleibt fuer den
     falschen, damit Erkennung und Bestandsdaten weiter passen. */
  { key: "satzbau", label: "falscher Satzbau", description: "Grammatisch falsch gebaut." },
  { key: "schlechter_satzbau", label: "schlechter Satzbau", description: "Verständlich, aber holprig." },
  { key: "inhaltsfehler", label: "Inhaltsfehler", description: "Sachlich unzutreffende Aussage." },
  { key: "falsche_zahl", label: "eine falsche Zahl", description: "Zahl, Einheit oder Größenordnung." },
  { key: "falsches_datum", label: "ein falsches Datum", description: "Datum, Jahr oder Zeitangabe." },
  { key: "falscher_name", label: "ein falscher Name", description: "Falsch geschrieben oder verwechselt." },
  { key: "toter_link", label: "ein toter Link", description: "Verweis führt ins Leere." },
  { key: "linktext", label: "nichtssagender Linktext", description: "Linktext ohne Aussage („hier“, „mehr“) — der Linkzweck ist nicht erkennbar (WCAG 2.4.4)." },
  { key: "sonstiges", label: "Sonstiges", description: "Passt in keine der übrigen Kategorien." },
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
