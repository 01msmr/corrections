/**
 * Sprachraum-Kuerzel fuer Redaktionen, als ISO-3166-1-Alpha-2.
 *
 * Hier stehen nur die Kuerzel und ihre Gruppierung; die Namen kommen aus der
 * ICU-Datenbank der Laufzeit (Intl.DisplayNames). So bleibt keine uebersetzte
 * Namensliste zu pflegen, und die Schreibweisen entsprechen dem, was Nutzer
 * aus dem Betriebssystem kennen.
 *
 * Reihenfolge: deutschsprachig zuerst, dann das uebrige Europa, danach die
 * Weltregionen. Sortiert wird durchgaengig nach erwartbarer Haeufigkeit --
 * Einwohnerzahl und Gewicht des Sprachraums in deutschsprachiger
 * Berichterstattung. Alphabetisch waere neutraler, wuerde aber Andorra und
 * Grossbritannien gleich behandeln: gesucht wird fast immer eines der ersten
 * fuenf Kuerzel, und die sollen oben stehen.
 */
export interface RegionGroup {
  label: string;
  codes: readonly string[];
}

export const REGION_GROUPS: readonly RegionGroup[] = [
  { label: "Deutschsprachig", codes: ["DE", "AT", "CH", "LI", "LU"] },
  {
    label: "Europa",
    codes: [
      "GB", "FR", "IT", "ES", "PL", "UA", "RO", "NL", "BE", "CZ", "GR", "PT",
      "SE", "HU", "BG", "RS", "DK", "FI", "SK", "NO", "IE", "HR", "BA", "AL",
      "LT", "SI", "LV", "EE", "MK", "MD", "CY", "ME", "MT", "IS", "AD", "MC",
      "SM", "VA",
    ],
  },
  { label: "Nordamerika", codes: ["US", "CA", "MX"] },
  {
    label: "Asien",
    codes: ["CN", "IN", "ID", "PK", "BD", "JP", "PH", "VN", "TH", "KR", "MY", "TW", "HK", "SG"],
  },
  {
    label: "Naher und Mittlerer Osten",
    codes: ["TR", "EG", "IR", "IQ", "SA", "SY", "IL", "JO", "AE", "LB", "QA"],
  },
  {
    label: "Afrika",
    codes: ["NG", "ET", "ZA", "TZ", "KE", "UG", "DZ", "MA", "GH", "SN", "TN"],
  },
  {
    label: "Südamerika",
    codes: ["BR", "CO", "AR", "PE", "VE", "CL", "EC", "BO", "PY", "UY"],
  },
  { label: "Ozeanien", codes: ["AU", "NZ"] },
  { label: "Sonstige", codes: ["RU", "BY", "CU", "KZ", "NP", "LK", "MM", "AF"] },
];

export interface RegionOption {
  code: string;
  name: string;
}

export interface RegionOptionGroup {
  label: string;
  options: RegionOption[];
}

/**
 * Loest die Kuerzel gegen die Anzeigenamen der Laufzeit auf und sortiert je
 * Gruppe alphabetisch. `extra` haengt ein Kuerzel an, das nicht in den Gruppen
 * steht — sonst verloere ein Bearbeiten-Formular einen Altwert stillschweigend.
 */
export function regionOptionGroups(locale = "de", extra?: string | null): RegionOptionGroup[] {
  const display = new Intl.DisplayNames([locale], { type: "region" });
  const known = new Set(REGION_GROUPS.flatMap((g) => g.codes));

  const groups = REGION_GROUPS.map((group) => ({
    label: group.label,
    // Bewusst ohne Sortierung: die Reihenfolge in REGION_GROUPS ist gepflegt.
    options: group.codes.map((code) => ({ code, name: display.of(code) ?? code })),
  }));

  const upper = extra?.trim().toUpperCase();
  if (upper && !known.has(upper)) {
    groups.push({
      label: "Bereits erfasst",
      options: [{ code: upper, name: display.of(upper) ?? upper }],
    });
  }
  return groups;
}

/**
 * Leitet den Sprachraum aus der Domain ab: Laender-Endungen sind ISO-3166-
 * Kuerzel (mit der historischen Ausnahme .uk fuer GB). Generische Endungen
 * wie .com oder .org tragen keine Herkunft -- dann null, nie geraten.
 */
export function regionForDomain(domain: string): string | null {
  const teile = domain.trim().toLowerCase().split(".");
  const endung = teile[teile.length - 1] ?? "";
  const code = endung === "uk" ? "GB" : endung.length === 2 ? endung.toUpperCase() : null;
  if (code === null) return null;
  const bekannt = new Set(REGION_GROUPS.flatMap((g) => g.codes));
  return bekannt.has(code) ? code : null;
}
