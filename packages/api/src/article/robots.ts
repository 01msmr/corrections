/**
 * robots.txt für die wiederkehrende Artikel-Prüfung. Nicht für den Abruf
 * beim Melden: der ist die Fortsetzung des eigenen Lesens.
 *
 * Zweck ist weniger Gehorsam als Symmetrie — eine Redaktion, die diesen
 * Abrufer nicht möchte, soll das sagen können, ohne IPs zu sperren.
 * Deshalb zählt auch unser eigener Name, nicht nur `*`.
 */
const EIGENER_AGENT = "KorrekturTracker";
const FRIST = 86_400;

interface Regel {
  pfad: string;
  erlaubt: boolean;
}

/** Wählt die Gruppe für einen Agenten und wertet ihre Regeln aus. */
export function darfAbrufen(robots: string, pfad: string, agent = EIGENER_AGENT): boolean {
  const gruppen = liesGruppen(robots);
  const eigene = gruppen.get(agent.toLowerCase());
  const alle = gruppen.get("*");
  const regeln = eigene ?? alle;
  if (!regeln || regeln.length === 0) return true;

  /* Die genauere Regel gewinnt; bei gleicher Länge die Erlaubnis. */
  let treffer: Regel | null = null;
  for (const regel of regeln) {
    if (!pfad.startsWith(regel.pfad)) continue;
    if (
      treffer === null ||
      regel.pfad.length > treffer.pfad.length ||
      (regel.pfad.length === treffer.pfad.length && regel.erlaubt)
    ) {
      treffer = regel;
    }
  }
  return treffer === null ? true : treffer.erlaubt;
}

function liesGruppen(robots: string): Map<string, Regel[]> {
  const gruppen = new Map<string, Regel[]>();
  let aktuelle: string[] = [];
  let regelnBegonnen = false;

  for (const rohzeile of robots.split(/\r?\n/)) {
    const zeile = rohzeile.split("#")[0]?.trim() ?? "";
    if (zeile.length === 0) continue;
    const [feldRoh, ...rest] = zeile.split(":");
    const feld = (feldRoh ?? "").trim().toLowerCase();
    const wert = rest.join(":").trim();

    if (feld === "user-agent") {
      if (regelnBegonnen) {
        aktuelle = [];
        regelnBegonnen = false;
      }
      aktuelle.push(wert.toLowerCase());
      if (!gruppen.has(wert.toLowerCase())) gruppen.set(wert.toLowerCase(), []);
      continue;
    }

    if (feld !== "disallow" && feld !== "allow") continue;
    regelnBegonnen = true;
    /* "Disallow:" ohne Wert ist die ausdrückliche Erlaubnis. */
    if (feld === "disallow" && wert.length === 0) continue;
    for (const name of aktuelle) {
      gruppen.get(name)?.push({ pfad: wert, erlaubt: feld === "allow" });
    }
  }
  return gruppen;
}

export interface WaechterDeps {
  holeText: (url: string) => Promise<string>;
  now: () => number;
}

/** Fragt je Domain einmal am Tag und antwortet im Zweifel mit Ja. */
export function robotsWaechter(deps: WaechterDeps): { darf: (adresse: string) => Promise<boolean> } {
  const bekannt = new Map<string, { text: string; geholt: number }>();

  return {
    async darf(adresse: string): Promise<boolean> {
      let ziel: URL;
      try {
        ziel = new URL(adresse);
      } catch {
        return true;
      }

      const eintrag = bekannt.get(ziel.host);
      const jetzt = deps.now();
      let text = eintrag && jetzt - eintrag.geholt < FRIST ? eintrag.text : null;

      if (text === null) {
        try {
          text = await deps.holeText(`${ziel.origin}/robots.txt`);
        } catch {
          text = "";
        }
        bekannt.set(ziel.host, { text, geholt: jetzt });
      }

      return darfAbrufen(text, ziel.pathname, EIGENER_AGENT);
    },
  };
}
