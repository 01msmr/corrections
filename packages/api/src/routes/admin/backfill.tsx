import { Hono } from "hono";
import type { Db } from "../../db/client.js";
import {
  ergaenzeKontaktadressen,
  importiereEntscheidungen,
  leseEntscheidungen,
} from "../../tools/backfillImport.js";
import { BackfillSeite } from "../../views/backfill.js";

/**
 * Einmaliger Altbestand-Import über die Oberfläche (§11.5). Nötig, weil die
 * SSH-Umgebung des Hosters keine Node-Laufzeit bereitstellt — das Werkzeug
 * läuft deshalb im Serverprozess statt als eigenes Kommando.
 *
 * Liegt hinter der Admin-Auth (siehe app.ts) und schreibt ausschließlich über
 * `importiereEntscheidungen`: anlegen, was fehlt, sonst nichts.
 */
export function backfillAdminRoutes(db: Db, now: () => number): Hono {
  const app = new Hono();

  app.get("/admin/backfill", (c) => c.html(<BackfillSeite />));

  app.post("/admin/backfill", async (c) => {
    const body = await c.req.parseBody();
    const datei = body["datei"];
    if (!(datei instanceof File) || datei.size === 0) {
      return c.html(<BackfillSeite fehler="Keine Datei ausgewählt." />, 400);
    }

    const { eintraege, fehler: lesefehler } = leseEntscheidungen(await datei.text());
    if (eintraege.length === 0) {
      return c.html(
        <BackfillSeite
          fehler="Die Datei enthält keine lesbaren Entscheidungen."
          lesefehler={lesefehler}
        />,
        400,
      );
    }

    const ergebnis = importiereEntscheidungen(db, eintraege, now());
    /* Medien ohne Adresse bekommen die tatsaechlich benutzte nachgetragen. */
    const adressen = ergaenzeKontaktadressen(db);
    return c.html(<BackfillSeite ergebnis={ergebnis} lesefehler={lesefehler} adressen={adressen} />);
  });

  return app;
}
