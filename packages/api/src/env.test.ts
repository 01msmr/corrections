import { describe, expect, it } from "vitest";
import { loadWorkerEnv } from "./env.js";

/* Der Worker laeuft als geplante Aufgabe, ausserhalb des Passenger-Prozesses:
   dort reicht Plesk seine Umgebungsvariablen nicht durch. Er prueft deshalb
   nur, was er selbst braucht -- Admin- und SMTP-Zugaenge muessen fuer ihn
   nirgends ein zweites Mal liegen. */
describe("loadWorkerEnv", () => {
  it("kommt ohne Admin- und SMTP-Zugaenge aus", () => {
    const env = loadWorkerEnv({
      MIGRATIONS_DIR: "./migrations",
      IMAP_HOST: "mx.example.tld",
      IMAP_USER: "post@example.tld",
      IMAP_PASSWORD: "geheim",
    });
    expect(env.IMAP_HOST).toBe("mx.example.tld");
    expect(env.IMAP_PORT).toBe(993);
    expect(env.IMAP_TRASH).toBe("Trash");
    expect(env.MIGRATIONS_DIR).toBe("./migrations");
  });

  it("laeuft auch ohne IMAP -- der Worker ueberspringt den Gang dann", () => {
    expect(() => loadWorkerEnv({})).not.toThrow();
  });
});
