import { describe, expect, it } from "vitest";
import { fehlerDetails } from "./postfach.js";

/* "Command failed" allein sagt nichts: imapflow haengt die Serverantwort ans
   Fehlerobjekt, und nur die verraet, welcher Befehl abgelehnt wurde. */
describe("fehlerDetails", () => {
  it("holt die Serverantwort aus einem imapflow-Fehler", () => {
    const fehler = Object.assign(new Error("Command failed"), {
      responseStatus: "NO",
      responseText: "Mailbox doesn't exist: Trash",
      executedCommand: "A5 MOVE 1:3 Trash",
    });
    expect(fehlerDetails(fehler)).toEqual({
      responseStatus: "NO",
      responseText: "Mailbox doesn't exist: Trash",
      executedCommand: "A5 MOVE 1:3 Trash",
    });
  });

  it("bleibt still bei gewoehnlichen Fehlern", () => {
    expect(fehlerDetails(new Error("kaputt"))).toEqual({});
    expect(fehlerDetails("Zeichenkette")).toEqual({});
  });
});
