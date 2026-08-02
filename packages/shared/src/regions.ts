/**
 * Sprachraum-Kuerzel fuer Redaktionen, als ISO-3166-1-Alpha-2.
 *
 * Hier stehen nur die Kuerzel und ihre Gruppierung; die Namen kommen aus der
 * ICU-Datenbank der Laufzeit (Intl.DisplayNames). So bleibt keine uebersetzte
 * Namensliste zu pflegen, und die Schreibweisen entsprechen dem, was Nutzer
 * aus dem Betriebssystem kennen.
 *
 * Reihenfolge: deutschsprachig zuerst, dann das uebrige Europa, danach die
 * Weltregionen nach ihrer erwartbaren Haeufigkeit in deutschsprachiger
 * Berichterstattung. Innerhalb einer Gruppe wird nach dem angezeigten Namen
 * sortiert, nicht nach dem Kuerzel.
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
      "AL", "AD", "BE", "BA", "BG", "CY", "DK", "EE", "FI", "FR", "GB", "GR",
      "HR", "HU", "IE", "IS", "IT", "LT", "LV", "MC", "MD", "ME", "MK", "MT",
      "NL", "NO", "PL", "PT", "RO", "RS", "SE", "SI", "SK", "SM", "ES", "UA",
      "VA",
    ],
  },
  { label: "Nordamerika", codes: ["US", "CA", "MX"] },
  {
    label: "Asien",
    codes: ["CN", "IN", "ID", "JP", "KR", "MY", "PH", "PK", "SG", "TH", "TW", "VN", "BD", "HK"],
  },
  {
    label: "Naher und Mittlerer Osten",
    codes: ["TR", "IL", "IR", "SA", "AE", "EG", "IQ", "JO", "LB", "QA", "SY"],
  },
  {
    label: "Afrika",
    codes: ["ZA", "NG", "KE", "MA", "ET", "GH", "TN", "DZ", "SN", "TZ", "UG"],
  },
  {
    label: "Südamerika",
    codes: ["BR", "AR", "CL", "CO", "PE", "UY", "VE", "BO", "EC", "PY"],
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
    options: group.codes
      .map((code) => ({ code, name: display.of(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name, locale)),
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
