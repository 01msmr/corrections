import type { FC } from "hono/jsx";
import { WEICHE_FEHLERARTEN, quotenlage } from "@korrektur/shared";
import type { ErrorTypeRecord } from "../repo/errorTypes.js";
import type {
  Ausgang,
  MeldungsDetail,
  MeldungsFilter,
  MeldungsZeile,
} from "../repo/meldungen.js";
import { AUSGAENGE } from "../repo/meldungen.js";
import type { OutletRecord } from "../repo/outlets.js";
import { fassungenHtml } from "../dispatch/compose.js";
import { Layout, NewspaperIcon, TagIcon } from "./layout.js";
import { vergleicheFassungen } from "./vergleich.js";

/**
 * Die Meldungshistorie (Plan 2026-08-13). Nicht oeffentlich — die Route
 * stellt sich selbst hinter die Auth; hier stehen deshalb auch Zitate,
 * Anker und Versanddaten.
 */

/** Betreiber-Wortwelt der Ausgaenge. Text, keine Wertungsfarben. */
export const AUSGANG_NAMEN: Record<Ausgang, string> = {
  open: "ohne Rückmeldung",
  acknowledged: "Antwort erhalten",
  corrected: "korrigiert wie vorgeschlagen",
  corrected_other: "anders korrigiert",
  rejected: "als richtig benannt",
  /* Altlast aus fruehen Datenstaenden; wird nicht mehr vergeben. */
  no_response: "keine Rückmeldung (abgeschlossen)",
};

function datum(epoche: number | null): string {
  if (epoche === null) return "—";
  const d = new Date(epoche * 1000);
  return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`;
}

/** Ein Datum fuer <input type="date">: JJJJ-MM-TT oder leer. */
function datumsWert(epoche: number | null): string {
  if (epoche === null) return "";
  return new Date(epoche * 1000).toISOString().slice(0, 10);
}

const SCHWERE: Record<number, string> = { 1: "leicht", 2: "mittel", 3: "schwer" };

/** Kurzformen fuer Smartphone und Tablet-Hochformat.
    "richtig": die Redaktion benennt ihre Fassung als richtig. */
const AUSGANG_KURZ: Record<Ausgang, string> = {
  open: "ohne",
  acknowledged: "Antwort",
  corrected: "korrigiert",
  corrected_other: "anders",
  rejected: "richtig",
  no_response: "beendet",
};

/** Weiche Kategorie? Dann traegt der Chip den blasseren Grund. */
function istWeich(key: string): boolean {
  return (WEICHE_FEHLERARTEN as readonly string[]).includes(key);
}

/** Fuers Karten-Band: fuehrende Artikel und Adjektive fallen weg
    ("ein falscher Name" -> "Name"); "Wörter fehlen" bleibt ganz. */
function kurzeKategorie(label: string): string {
  const woerter = label.split(" ");
  while (
    woerter.length > 1 &&
    /^(ein|eine|[a-zäöü]\S*(er|e))$/.test(woerter[0] ?? "") &&
    /^[A-ZÄÖÜ]/.test(woerter[1] ?? "")
  ) {
    woerter.shift();
  }
  return woerter.join(" ");
}

/** Erste, letzte und die Nachbarn der aktuellen Seite; dazwischen "…". */
function seitenfenster(seite: number, seiten: number): (number | "…")[] {
  const eintraege: (number | "…")[] = [];
  for (let p = 1; p <= seiten; p++) {
    if (p === 1 || p === seiten || Math.abs(p - seite) <= 2) {
      eintraege.push(p);
    } else if (eintraege[eintraege.length - 1] !== "…") {
      eintraege.push("…");
    }
  }
  return eintraege;
}

export const MeldungsListe: FC<{
  zeilen: MeldungsZeile[];
  gesamt: number;
  seite: number;
  seiten: number;
  filter: MeldungsFilter;
  outlets: OutletRecord[];
  errorTypes: ErrorTypeRecord[];
}> = ({ zeilen, gesamt, seite, seiten, filter, outlets, errorTypes }) => {
  /* Seiten-Links behalten die Filter; gebaut aus denselben Werten wie das
     Formular. */
  const blaetterHref = (ziel: number): string => {
    const q = new URLSearchParams();
    if (filter.outletId) q.set("medium", filter.outletId);
    if (filter.errorTypeId) q.set("kategorie", filter.errorTypeId);
    if (filter.ausgang) q.set("ausgang", filter.ausgang);
    if (filter.suche) q.set("suche", filter.suche);
    if (ziel > 1) q.set("seite", String(ziel));
    const text = q.toString();
    return text ? `/admin/meldungen?${text}` : "/admin/meldungen";
  };
  return (
    <Layout title="Meldungen" aktiv="meldungen" betreiber>
      {/* Keine Zwischenueberschrift: die aktive Marke in der Navigation
          benennt die Seite schon, ein Balken doppelte nur. */}
      <div class="listenrumpf">
      {/* Ausserhalb des Quer-Scrollers, sonst klebt sie an dessen Scrollfenster. */}
      <form method="get" action="/admin/meldungen" class="filterzeile">
        {/* Die Gesamtzahl der Treffer steht vor den Filtern, in der Zeile. */}
        <span class="trefferzahl">{gesamt}</span>
        {/* Schmal: Icon als Beschriftung, der Select selbst zeigt kurz das
            Gewaehlte (Breitendeckel + Ellipse). */}
        <label class="filterfeld">
          <NewspaperIcon />
          <select name="medium" aria-label="Medium">
            <option value="">alle Medien</option>
            {outlets.map((o) => (
              <option value={o.id} selected={o.id === filter.outletId}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label class="filterfeld">
          <TagIcon />
          <select name="kategorie" aria-label="Kategorie">
            <option value="">alle Kategorien</option>
            {errorTypes.map((t) => (
              <option value={t.id} selected={t.id === filter.errorTypeId}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <select name="ausgang" aria-label="Ausgang">
          <option value="">alle Ausgänge</option>
          {AUSGAENGE.map((wert) => (
            <option value={wert} selected={wert === filter.ausgang}>
              {AUSGANG_NAMEN[wert]}
            </option>
          ))}
        </select>
        <input
          type="search"
          name="suche"
          value={filter.suche ?? ""}
          placeholder="Kennung, Überschrift, Adresse"
          aria-label="Suche"
        />
      </form>
      <script
        dangerouslySetInnerHTML={{
          __html: `
  /* Kein Filtern-Knopf: die Auswahlen schicken sich selbst ab, das Suchfeld
     schickt ueber die Eingabetaste. Mehr Skript braucht die Seite nicht --
     die feste Schale ist reines CSS (siehe .listenrumpf im Layout). */
  for (const auswahl of document.querySelectorAll(".filterzeile select")) {
    auswahl.addEventListener("change", () => auswahl.form.requestSubmit());
  }

  /* Drei gemessene Hoehen als CSS-Variablen: die Kopfhoehe fuer die
     klebende Filterzeile (der Kopf schrumpft schmal beim Scrollen), die
     Fusszeile fuer den Sitz der Blaetterreihe, beide zusammen fuer den
     Platz, den das Blatt unten freihaelt. */
  /* Erst nach dem fertigen Dokument: dieses Skript steht VOR der Fusszeile
     im Markup -- wer sie sofort suchte, faende nichts und setzte die
     Fusshoehe auf null. Dann saessen Blaetterreihe und Fusszeile beide auf
     bottom: 0 und ueberdeckten sich. */
  addEventListener("DOMContentLoaded", () => {
    const wurzel = document.documentElement;
    const kopf = document.querySelector(".klebekopf");
    const reihe = document.querySelector(".seitenblaettern");
    const fusszeile = document.querySelector(".fusszeile");
    const filterzeile = document.querySelector(".filterzeile");
    const messe = () => {
      const kopfhoehe = kopf ? kopf.getBoundingClientRect().height : 0;
      if (kopf) wurzel.style.setProperty("--kopfhoehe", kopfhoehe + "px");
      /* Halt der Spaltenkoepfe: beide schrumpfen, also messen. */
      const filter = filterzeile ? filterzeile.getBoundingClientRect().height : 0;
      wurzel.style.setProperty("--kopfleiste", kopfhoehe + filter + "px");
      const fuss = fusszeile ? fusszeile.getBoundingClientRect().height : 0;
      wurzel.style.setProperty("--fusshoehe", fuss + "px");
      const leiste = fuss + (reihe ? reihe.getBoundingClientRect().height : 0);
      wurzel.style.setProperty("--leistehoehe", leiste + 4 + "px");
    };
    for (const ziel of [kopf, reihe, fusszeile, filterzeile]) {
      if (ziel) new ResizeObserver(messe).observe(ziel);
    }
    messe();
  });

  /* Die ganze Zeile ist Ausloeser fuers Titel-Scrollen: eine horizontale
     Geste irgendwo auf der Tabelle schiebt den Artikeltitel der Zeile
     unter dem Zeiger -- die Tabelle selbst bewegt sich nicht. Erst nach
     dem fertigen Dokument: die Tabelle steht im Markup hinter diesem
     Skript. */
  addEventListener("DOMContentLoaded", () =>
  document.querySelector(".meldungsliste")?.addEventListener("wheel", (e) => {
    const quer = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (!quer) return;
    /* Die Quergeste gehoert ab hier der Liste, auch wenn sie ins Leere
       laeuft -- sonst blaettert der Browser in der Historie zurueck. */
    e.preventDefault();
    const titel = e.target.closest("tr")?.querySelector(".sp-artikel");
    if (!titel || titel.scrollWidth <= titel.clientWidth) return;
    titel.scrollLeft += e.deltaX || e.deltaY;
  }, { passive: false }));`,
        }}
      />

      {/* Spaltenklassen: schmal wird aus jeder Zeile eine Karte. */}
      <div class="querblatt">
      <table class="sortierbar meldungsliste">
        <thead>
          <tr>
            <th class="sp-nr">Nr</th>
            <th class="sp-kennung">Kennung</th>
            <th class="sp-datum">Datum</th>
            <th class="sp-medium">Medium</th>
            <th class="sp-artikel">Artikel</th>
            <th class="sp-kategorie">Kategorie</th>
            <th class="sp-grad">Grad</th>
            <th class="sp-ausgang">Ausgang</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr data-href={`/admin/meldungen/${z.id}`}>
              <td class="sp-nr">{z.nummer}</td>
              <td class="sp-kennung">
                <span class="nrim">{z.nummer}&nbsp;·&nbsp;</span>
                <a href={`/admin/meldungen/${z.id}`} draggable={false}>
                  <code>{z.ref}</code>
                </a>
              </td>
              <td class="sp-datum">{datum(z.zeitpunkt)}</td>
              <td class="sp-medium">{z.medium}</td>
              <td class="sp-artikel" title={z.articleUrl}>{z.headline ?? z.articleUrl}</td>
              <td class={istWeich(z.kategorieKey) ? "sp-kategorie weich" : "sp-kategorie"}>
                <span class="langform">{z.kategorie}</span>
                <span class="kurzform">{kurzeKategorie(z.kategorie)}</span>
              </td>
              <td class="sp-grad">
                <span class={`gradchip grad-${z.severity}`}>
                  {SCHWERE[z.severity] ?? String(z.severity)}
                </span>
              </td>
              <td class="sp-ausgang">
                <span class="langform">{AUSGANG_NAMEN[z.outcome]}</span>
                <span class="kurzform">{AUSGANG_KURZ[z.outcome]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {zeilen.length === 0 ? <p class="zaehler">Nichts gefunden.</p> : null}
      </div>
      </div>

      {/* Immer da, auch bei einer Seite oder leer: der Platz gehoert zur
          Schale, das Blatt springt nicht, wenn ein Filter die Seitenzahl
          aendert. */}
      <nav class="seitenblaettern" aria-label="Seiten">
          {seite > 1 ? (
            <a class="knopf" href={blaetterHref(seite - 1)}>zurück</a>
          ) : (
            <span class="seitenrand">zurück</span>
          )}
          {seitenfenster(seite, seiten).map((eintrag) =>
            eintrag === "…" ? (
              <span class="zaehler">…</span>
            ) : eintrag === seite ? (
              /* Die aktive Seite ist kein Ziel: eingedrueckter Klotz, kein
                 Link. */
              <span class="seitenknopf-aktiv" aria-current="page">
                {eintrag}
              </span>
            ) : (
              <a class="knopf" href={blaetterHref(eintrag)}>
                {eintrag}
              </a>
            ),
          )}
          {seite < seiten ? (
            <a class="knopf" href={blaetterHref(seite + 1)}>vor</a>
          ) : (
            <span class="seitenrand">vor</span>
          )}
        </nav>
    </Layout>
  );
};

export const MeldungsAnsicht: FC<{ detail: MeldungsDetail; hinweis?: string | undefined }> = ({
  detail,
  hinweis,
}) => {
  const m = detail.meldung;
  const fahne = vergleicheFassungen(m.quoteBefore, m.suggestionAfter);
  /* Der Ausgang kann gesetzt sein und die Quote sich trotzdem nicht bewegen
     -- ohne diese Zeile ist das von aussen nicht zu sehen. */
  const pruefungen = detail.ereignisse.filter((e) => e.art !== "reply" && e.art !== "autoreply" && e.art !== "bounce");
  const lage = quotenlage(
    {
      dispatchStatus: m.dispatchStatus,
      sentAt: m.sentAt,
      correctedAt: m.correctedAt,
      verification: m.verification,
      letzterBefund: pruefungen[pruefungen.length - 1]?.art ?? null,
    },
    Math.floor(Date.now() / 1000),
  );
  /* Dieselbe Auszeichnung wie in der Mail: Fehlstelle hell auf Karmin bzw.
     Gruen, der Teilsatz darum fett. Eine Quelle (compose.ts), kein Nachbau. */
  const fassungen = fassungenHtml(m.quoteBefore, m.suggestionAfter);
  return (
    <Layout title={`Meldung ${m.ref}`} aktiv="meldungen" betreiber>
      {hinweis ? <p class="hinweis fluechtig">{hinweis}</p> : null}
      <h2 class="balken">
        Nr. {detail.nummer} — <code>{m.ref}</code>
      </h2>
      <p class="zaehler">
        {detail.medium} · {detail.kategorie} · {SCHWERE[m.severity] ?? m.severity} · gesendet{" "}
        {datum(m.sentAt)} ({m.dispatchMode}
        {m.sendConfirmedBy ? `, bestätigt: ${m.sendConfirmedBy}` : ""}) · Quelle: {m.source}
      </p>
      <p>
        <a href={m.articleUrl} target="_blank" rel="noopener">
          {m.headline ?? m.articleUrl}
        </a>
      </p>

      <p class="zaehler">
        Korrekturquote:{" "}
        {lage.zaehlt ? "zählt mit" : `zählt nicht mit — ${lage.grund}`}
      </p>

      <p class="fahne">
        <span class="zaehler">Korrekturfahne:</span>
        <br />
        {fahne.map((stueck, i) => (
          <>
            {i > 0 ? " " : ""}
            {stueck.art === "gleich" ? (
              stueck.text
            ) : stueck.art === "getilgt" ? (
              <del>{stueck.text}</del>
            ) : (
              <ins>{stueck.text}</ins>
            )}
          </>
        ))}
      </p>

      <h2>Falsch ist</h2>
      <blockquote class="anker">
        {m.quotePrefix ? <span class="zaehler">…{m.quotePrefix} </span> : null}
        <span dangerouslySetInnerHTML={{ __html: fassungen.falsch }} />
        {m.quoteSuffix ? <span class="zaehler"> {m.quoteSuffix}…</span> : null}
      </blockquote>
      <h2>Richtig wäre</h2>
      <blockquote class="anker">
        <span dangerouslySetInnerHTML={{ __html: fassungen.richtig }} />
      </blockquote>
      {m.comment ? (
        <>
          <h2>Anmerkung</h2>
          <p>{m.comment}</p>
        </>
      ) : null}

      <h2 class="balken">Ereignisse</h2>
      {detail.ereignisse.length === 0 ? (
        <p class="zaehler">Noch keine — weder Antwort noch Artikel-Prüfung.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Art</th>
              <th>Hinweis</th>
            </tr>
          </thead>
          <tbody>
            {detail.ereignisse.map((e) => (
              <tr>
                <td>{datum(e.zeitpunkt)}</td>
                <td>{e.art}</td>
                <td>{e.hinweis ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 class="balken">Ausgang</h2>
      <form method="post" action={`/admin/meldungen/${m.id}/ausgang`}>
        <label for="ausgang">Ausgang:</label>
        <select id="ausgang" name="ausgang">
          {AUSGAENGE.map((wert) => (
            <option value={wert} selected={wert === m.outcome}>
              {AUSGANG_NAMEN[wert]}
            </option>
          ))}
        </select>

        <label for="antwortAm">
          <span>Antwort vom:</span>{" "}
          <span class="zaehler">
            Datum der echten Antwort — Eingangsbestätigungen zählen nicht
          </span>
        </label>
        <input type="date" id="antwortAm" name="antwortAm" value={datumsWert(m.respondedAt)} />

        <label for="korrigiertAm">Korrigiert am:</label>
        <input
          type="date"
          id="korrigiertAm"
          name="korrigiertAm"
          value={datumsWert(m.correctedAt)}
        />

        {/* Nur bei "anders korrigiert" gefragt, aber immer sichtbar: ein
            Feld, das erst nach der Auswahl erschiene, wuerde uebersehen. */}
        <label for="korrigierterText">Neue Fassung im Artikel:</label>
        <textarea
          id="korrigierterText"
          name="korrigierterText"
          rows={2}
          placeholder="nur bei „anders korrigiert“ — was jetzt dort steht"
        >
          {m.correctedText ?? ""}
        </textarea>

        <button type="submit">Ausgang setzen</button>
      </form>

      <p>
        <a class="zurueckliste" href="/admin/meldungen">← zurück zur Liste</a>
      </p>
    </Layout>
  );
};
