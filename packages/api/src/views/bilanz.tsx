import { MATURITY_DAYS, MIN_N_FOR_RATE, rateOrNull, wilsonInterval } from "@korrektur/shared";
import type { FC } from "hono/jsx";
import { UEBRIGE_NAME, type Bilanz, type Quotenstand, type Verteilungswert } from "../repo/bilanz.js";
import { Layout } from "./layout.js";

/**
 * Die Bilanz zeigt zuerst, was gemeldet wurde, und erst dann, was daraus
 * folgte — denn die Reaktionsdaten entstehen später (§9). Wo die Fallzahl
 * für eine Quote nicht reicht, steht das ausdrücklich da: kein Prozentwert
 * ohne sein n, keine Quote unter MIN_N_FOR_RATE (§9.4). Medien kommen
 * alphabetisch vom Server; umsortieren kann sie nur, wer im Browser einen
 * Spaltenkopf anklickt — die Voreinstellung stellt also keine Rangfolge auf,
 * und der Hinweis unter der Tabelle ordnet die Zahl ein (§2.2, §9.1).
 */

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function monatJahr(epochSekunden: number): string {
  const datum = new Date(epochSekunden * 1000);
  return `${MONATE[datum.getUTCMonth()] ?? ""} ${datum.getUTCFullYear()}`;
}

/** "2026-05" → "Mai 26" für die schmale Beschriftung unter dem Balken. */
function monatKurz(monat: string): string {
  const [jahr, nummer] = monat.split("-");
  const name = MONATE[Number(nummer) - 1]?.slice(0, 3) ?? monat;
  return `${name} ${jahr?.slice(2) ?? ""}`;
}

function prozent(anteil: number): string {
  return `${Math.round(anteil * 100)} %`;
}

/**
 * Eine Quote mit ihrem n — oder die ehrliche Auskunft, dass es noch nicht
 * reicht. Der Fehlerbalken (Wilson) steht als Spanne dabei, ausdrücklich
 * nicht als Rangfolge (§9.4).
 */
const Quote: FC<{
  titel: string;
  stand: Quotenstand;
  erlaeuterung: string;
  /** Warum es (noch) nichts zu rechnen gibt — steht statt eines Prozentwerts. */
  leerGrund: string;
}> = ({ titel, stand, erlaeuterung, leerGrund }) => {
  const quote = rateOrNull(stand.zaehler, stand.nenner);
  const spanne = quote === null ? null : wilsonInterval(stand.zaehler, stand.nenner);
  return (
    <div class="kennzahl">
      <span class="kennzahl-titel">{titel}</span>
      {quote === null ? (
        <>
          <span class="kennzahl-leer">noch keine Aussage</span>
          <span class="kennzahl-fuss">
            {stand.nenner === 0
              ? leerGrund
              : `${stand.zaehler} von ${stand.nenner} — erst ab ${MIN_N_FOR_RATE} wird gerechnet`}
          </span>
        </>
      ) : (
        <>
          <span class="kennzahl-wert">{prozent(quote)}</span>
          <span class="kennzahl-fuss">
            {stand.zaehler} von {stand.nenner}
            {spanne ? ` · Spanne ${prozent(spanne.lower)}–${prozent(spanne.upper)}` : ""}
          </span>
        </>
      )}
      <span class="kennzahl-erklaerung">{erlaeuterung}</span>
    </div>
  );
};

/**
 * Text am Segment: Anzahl, und daneben der Anteil des Mediums an allen
 * Meldungen als Massstab. Der Leser vergleicht selbst — wir behaupten keine
 * Ueber- oder Unterrepraesentation.
 */
function beschriftung(
  name: string,
  anzahl: number,
  grundanteil: Map<string, number> | undefined,
): string {
  const anteil = grundanteil?.get(name);
  return anteil === undefined
    ? `${name} — ${anzahl}`
    : `${name} — ${anzahl} · Anteil an allen Meldungen: ${Math.round(anteil * 100)} %`;
}

/** Waagerechte Balken; der längste Balken füllt die Breite. Bringt ein Wert
 *  `beteiligte` mit, teilt sich die Füllung in anteilige Segmente. */
const Verteilung: FC<{
  werte: Verteilungswert[];
  /** Anteil eines Mediums an ALLEN Meldungen — als Vergleichsmassstab im
   *  Tooltip. Wir verrechnen ihn nicht: die Fallzahlen je Balken sind zu
   *  klein, eine Normierung machte Zufall zur Aussage (§2.2). */
  grundanteil?: Map<string, number>;
}> = ({ werte, grundanteil }) => {
  const groesster = werte.reduce((max, wert) => Math.max(max, wert.anzahl), 0);
  return (
    <div class="verteilung">
      {werte.map((wert) => (
        <div class="balkenzeile">
          <span class="balkenname">{wert.name}</span>
          <span class="balkenwert">{wert.anzahl}</span>
          <span class="balkenspur">
            <span
              class="balkenfuellung"
              style={`width: ${groesster > 0 ? (wert.anzahl / groesster) * 100 : 0}%`}
            >
              {(wert.beteiligte ?? []).map((teil) => (
                <span
                  class={teil.name === UEBRIGE_NAME ? "balkenteil uebrige" : "balkenteil"}
                  style={`width: ${wert.anzahl > 0 ? (teil.anzahl / wert.anzahl) * 100 : 0}%`}
                  role="img"
                  title={beschriftung(teil.name, teil.anzahl, grundanteil)}
                  aria-label={beschriftung(teil.name, teil.anzahl, grundanteil)}
                >
                  {teil.name !== UEBRIGE_NAME && (
                    <span class="balkenteilname">
                      {teil.name}
                      <span class="teilzahl">{teil.anzahl}</span>
                    </span>
                  )}
                </span>
              ))}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * Zaehlweise-Umschalter als zweiteilige Pille, rechts oben im Balken der
 * Graphen. Serverseitig ueber ?alle=1 — kein JavaScript, kein Flackern.
 * Die aktive Haelfte ist nicht anklickbar; sie zeigt nur den Stand.
 */
const Zaehlweise: FC<{ mitWeichen: boolean; weicheNamen: string }> = ({
  mitWeichen,
  weicheNamen,
}) => (
  <span class="zaehlweise" title={`Weiche Kategorien: ${weicheNamen}`}>
    {mitWeichen ? (
      <a href="/bilanz" data-teil="zaehlweise">ohne weiche</a>
    ) : (
      <span aria-current="true">ohne weiche</span>
    )}
    {mitWeichen ? (
      <span aria-current="true">alle</span>
    ) : (
      <a href="/bilanz?alle=1" data-teil="zaehlweise">alle</a>
    )}
  </span>
);

export const BilanzSeite: FC<{
  bilanz: Bilanz;
  betreiber?: boolean;
  /** Zaehlweise des Umschalters: true = auch weiche Kategorien. */
  mitWeichen?: boolean;
  /** Sichtbare Namen der weichen Kategorien, fuer die Umschalt-Zeile. */
  weicheLabels?: string[];
}> = ({
  bilanz,
  betreiber = false,
  mitWeichen = false,
  weicheLabels = [],
}) => {
  const weicheNamen = weicheLabels.map((label) => `„${label}“`).join(", ");
  /* Vergleichsmassstab fuer die Segment-Beschriftung, aus derselben
     Zaehlweise wie die Balken. */
  const grundanteil = new Map(
    bilanz.medienListe.map((eintrag) => [
      eintrag.name,
      bilanz.meldungen > 0 ? eintrag.anzahl / bilanz.meldungen : 0,
    ]),
  );
  const hoechsterMonat = bilanz.verlauf.reduce((max, wert) => Math.max(max, wert.anzahl), 0);
  const zeitraum =
    bilanz.von !== null && bilanz.bis !== null
      ? `${monatJahr(bilanz.von)} – ${monatJahr(bilanz.bis)}`
      : "—";

  return (
    <Layout title="Bilanz" aktiv="bilanz" betreiber={betreiber}>
      {bilanz.meldungen === 0 ? (
        <p class="hinweis">
          Noch nichts erfasst. Sobald die ersten Korrekturen versendet sind, stehen hier
          die Zahlen.
        </p>
      ) : (
        <>
          <div class="eckdaten">
            <div class="kennzahl">
              <span class="kennzahl-titel">Korrekturen</span>
              <span class="kennzahl-wert">{bilanz.meldungen}</span>
              <span class="kennzahl-fuss">an {bilanz.medien} Medien</span>
            </div>
            <div class="kennzahl">
              <span class="kennzahl-titel">Zeitraum</span>
              <span class="kennzahl-wert klein">{zeitraum}</span>
              <span class="kennzahl-fuss">
                {bilanz.reifUndZustellbar} davon älter als {MATURITY_DAYS} Tage
              </span>
            </div>
          </div>

          <h2 class="balken">Was daraus wurde</h2>
          <div class="eckdaten">
            <Quote
              titel="Korrekturquote"
              stand={bilanz.korrektur}
              leerGrund="noch kein Artikel nachgeprüft"
              erlaeuterung="Anteil der Korrekturen, nach denen der Artikel nachweislich berichtigt wurde."
            />
            <Quote
              titel="Antwortquote"
              stand={bilanz.antwort}
              leerGrund="noch kein Postfach-Abgleich gelaufen"
              erlaeuterung="Anteil der versendeten Korrekturen, auf die eine Redaktion geantwortet hat."
            />
          </div>
          <h2 class="balken">Was auffällt<Zaehlweise mitWeichen={mitWeichen} weicheNamen={weicheNamen} /></h2>
          <Verteilung werte={bilanz.fehlerarten} grundanteil={grundanteil} />

          <h2 class="balken">Wie schwer<Zaehlweise mitWeichen={mitWeichen} weicheNamen={weicheNamen} /></h2>
          <Verteilung werte={bilanz.schwere} />

          <h2 class="balken">Verlauf<Zaehlweise mitWeichen={mitWeichen} weicheNamen={weicheNamen} /></h2>
          {/* Neuester Monat zuerst, dann rueckwaerts: der aktuelle Stand
              steht sichtbar vorn, auch wenn die Reihe quer scrollt. */}
          <div class="verlauf">
            {[...bilanz.verlauf].reverse().map((wert) => (
              <div class="verlaufsspalte" title={`${wert.anzahl} im ${wert.monat}`}>
                <span class="verlaufswert">{wert.anzahl}</span>
                <span
                  class="verlaufsbalken"
                  style={`height: ${hoechsterMonat > 0 ? (wert.anzahl / hoechsterMonat) * 100 : 0}%`}
                />
                <span class="verlaufsmonat">{monatKurz(wert.monat)}</span>
              </div>
            ))}
          </div>

          <h2 class="balken">Medien</h2>
          <p class="zaehler">
            Alphabetisch voreingestellt, über die Spaltenköpfe umsortierbar. Die Zahl
            sagt, wo viel gelesen und gemeldet wurde — sie sagt nichts darüber, wo mehr
            Fehler stehen. Nach Anzahl sortiert entsteht deshalb keine Rangfolge der
            Sorgfalt, sondern eine der Lesegewohnheiten.
          </p>
          <table class="sortierbar medienliste gleichspaltig">
            <thead>
              <tr>
                <th>Medium</th>
                <th>Korrekturen</th>
              </tr>
            </thead>
            <tbody>
              {bilanz.medienListe.map((eintrag) => (
                <tr>
                  <td>{eintrag.name}</td>
                  <td>{eintrag.anzahl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2 class="balken">Was diese Zahlen nicht sagen</h2>
      <div class="prosa-schmal prosa-zweispaltig">
        <p>
          Die gemeldeten Artikel sind <strong>keine Stichprobe</strong>. Gelesen wird, was
          interessiert; gemeldet wird, was dabei auffällt. Wer bei einem Medium viele
          Fehler findet, liest dort vermutlich viel — über die Sorgfalt einer Redaktion
          sagt die blanke Anzahl nichts.
        </p>
        <p>
          Eine Korrektur ohne Antwort heißt nicht, dass nichts geschah: Redaktionen
          korrigieren oft still. Deshalb ist die Korrekturquote die eigentliche Zahl und
          die Antwortquote nur eine Nebenauskunft.
        </p>
        <p>
          Was als Fehler gilt, ist teils Auslegung. Ein fehlendes Komma ist eindeutig,
          „schlechter Satzbau" ist es nicht. Die Kategorien stehen deshalb offen daneben,
          und jede Zahl nennt ihr n.
        </p>
      </div>
    </Layout>
  );
};
