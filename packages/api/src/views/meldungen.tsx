import type { FC } from "hono/jsx";
import type { ErrorTypeRecord } from "../repo/errorTypes.js";
import type {
  Ausgang,
  MeldungsDetail,
  MeldungsFilter,
  MeldungsZeile,
} from "../repo/meldungen.js";
import { AUSGAENGE } from "../repo/meldungen.js";
import type { OutletRecord } from "../repo/outlets.js";
import { Layout } from "./layout.js";
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
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(epoche * 1000));
}

/** Ein Datum fuer <input type="date">: JJJJ-MM-TT oder leer. */
function datumsWert(epoche: number | null): string {
  if (epoche === null) return "";
  return new Date(epoche * 1000).toISOString().slice(0, 10);
}

const SCHWERE: Record<number, string> = { 1: "leicht", 2: "mittel", 3: "schwer" };

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
      <h2 class="balken">Meldungen</h2>

      <form method="get" action="/admin/meldungen" class="filterzeile">
        {/* Die Gesamtzahl der Treffer steht vor den Filtern, in der Zeile. */}
        <span class="trefferzahl">{gesamt}</span>
        <select name="medium" aria-label="Medium">
          <option value="">alle Medien</option>
          {outlets.map((o) => (
            <option value={o.id} selected={o.id === filter.outletId}>
              {o.name}
            </option>
          ))}
        </select>
        <select name="kategorie" aria-label="Kategorie">
          <option value="">alle Kategorien</option>
          {errorTypes.map((t) => (
            <option value={t.id} selected={t.id === filter.errorTypeId}>
              {t.label}
            </option>
          ))}
        </select>
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
     schickt ueber die Eingabetaste. */
  for (const auswahl of document.querySelectorAll(".filterzeile select")) {
    auswahl.addEventListener("change", () => auswahl.form.requestSubmit());
  }

  /* Die Filterzeile klebt direkt unter dem klebenden Kopf -- als ein Block,
     nicht als zweites, eigenes Kleben. Der Kopf aendert seine Hoehe (schmal
     weicht das Datum beim Scrollen), deshalb wird sie gemessen statt
     geschaetzt. */
  const kopf = document.querySelector(".klebekopf");
  const filterzeile = document.querySelector(".filterzeile");
  if (kopf && filterzeile) {
    const setzeKante = () => {
      filterzeile.style.top = kopf.getBoundingClientRect().height + "px";
    };
    new ResizeObserver(setzeKante).observe(kopf);
    setzeKante();
  }

  /* Unten dasselbe Spiel: Fusszeile fest am Boden, die Blaetterreihe exakt
     darueber, und das Blatt reserviert genau die Hoehe des Blocks -- mehr
     scrollbarer Leerraum entsteht nicht. */
  const reihe = document.querySelector(".seitenblaettern");
  const fusszeile = document.querySelector(".fusszeile");
  const blatt = document.querySelector(".blatt");
  if (reihe) {
    const lege = () => {
      const fussHoehe = fusszeile ? fusszeile.getBoundingClientRect().height : 0;
      reihe.style.bottom = fussHoehe + "px";
      if (blatt) {
        blatt.style.paddingBottom = fussHoehe + reihe.getBoundingClientRect().height + 6 + "px";
      }
    };
    new ResizeObserver(lege).observe(reihe);
    if (fusszeile) new ResizeObserver(lege).observe(fusszeile);
    lege();
  }`,
        }}
      />

      <table class="sortierbar">
        <thead>
          <tr>
            <th>Nr</th>
            <th>Kennung</th>
            <th>Datum</th>
            <th>Medium</th>
            <th>Artikel</th>
            <th>Kategorie</th>
            <th>Grad</th>
            <th>Ausgang</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr data-href={`/admin/meldungen/${z.id}`}>
              <td>{z.nummer}</td>
              <td>
                <a href={`/admin/meldungen/${z.id}`} draggable={false}>
                  <code>{z.ref}</code>
                </a>
              </td>
              <td>{datum(z.zeitpunkt)}</td>
              <td>{z.medium}</td>
              <td title={z.articleUrl}>{z.headline ?? z.articleUrl}</td>
              <td>{z.kategorie}</td>
              <td>{SCHWERE[z.severity] ?? String(z.severity)}</td>
              <td>{AUSGANG_NAMEN[z.outcome]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {zeilen.length === 0 ? <p class="zaehler">Nichts gefunden.</p> : null}

      {seiten > 1 ? (
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
      ) : null}
    </Layout>
  );
};

export const MeldungsAnsicht: FC<{ detail: MeldungsDetail; hinweis?: string | undefined }> = ({
  detail,
  hinweis,
}) => {
  const m = detail.meldung;
  const fahne = vergleicheFassungen(m.quoteBefore, m.suggestionAfter);
  return (
    <Layout title={`Meldung ${m.ref}`} aktiv="meldungen" betreiber>
      {hinweis ? <p class="hinweis">{hinweis}</p> : null}
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
        {m.quotePrefix ? <span class="zaehler">…{m.quotePrefix}</span> : null}
        <strong>{m.quoteBefore}</strong>
        {m.quoteSuffix ? <span class="zaehler">{m.quoteSuffix}…</span> : null}
      </blockquote>
      <h2>Richtig wäre</h2>
      <blockquote class="anker">{m.suggestionAfter}</blockquote>
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

        <button type="submit">Ausgang setzen</button>
      </form>

      <p>
        <a href="/admin/meldungen">← zurück zur Liste</a>
      </p>
    </Layout>
  );
};
