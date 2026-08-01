export type RemovalOutcome = "deleted" | "archived" | "missing";

/**
 * Die Entscheidung, ob ein Stammdatensatz geloescht oder nur archiviert wird,
 * lebt an genau einer Stelle (§5.0). Wuerden Redaktionen und Fehlerarten sie
 * getrennt treffen, koennte eine der beiden Seiten spaeter abweichen und einen
 * referenzierten Eintrag hart loeschen — veroeffentlichte Zahlen aenderten sich
 * dann rueckwirkend. Die Abfragen bringt jeder Aufrufer selbst mit, nur die
 * Regel ist geteilt.
 */
export function removeOrArchive(steps: {
  exists: () => boolean;
  isReferenced: () => boolean;
  archive: () => void;
  hardDelete: () => void;
}): RemovalOutcome {
  if (!steps.exists()) return "missing";
  if (steps.isReferenced()) {
    steps.archive();
    return "archived";
  }
  steps.hardDelete();
  return "deleted";
}
