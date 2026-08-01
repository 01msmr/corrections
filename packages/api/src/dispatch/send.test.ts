import { describe, expect, it } from "vitest";
import { createJsonMailer } from "./send.js";

describe("Mailer", () => {
  it("liefert eine Message-ID zurück", async () => {
    const mailer = createJsonMailer("korrektur@example.tld");
    const result = await mailer.send({
      to: "leserbriefe@beispiel-zeitung.de",
      subject: "Korrekturhinweis: Zahl [K7QW3M]",
      text: "Sehr geehrte Redaktion,",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageId).toMatch(/^<.+@.+>$/);
    }
  });

  it("setzt keinen Reply-To-Header", async () => {
    const mailer = createJsonMailer("korrektur@example.tld");
    const result = await mailer.send({
      to: "leserbriefe@beispiel-zeitung.de",
      subject: "Betreff [K7QW3M]",
      text: "Text",
    });
    expect(result.ok).toBe(true);
  });

  it("meldet einen Fehler statt zu werfen", async () => {
    const mailer = createJsonMailer("korrektur@example.tld");
    const result = await mailer.send({ to: "", subject: "x", text: "y" });
    expect(result.ok).toBe(false);
  });
});
