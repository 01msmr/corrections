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
    let capturedMessage = "";
    const mailer = createJsonMailer("korrektur@example.tld", (raw) => {
      capturedMessage = raw;
    });
    const result = await mailer.send({
      to: "leserbriefe@beispiel-zeitung.de",
      subject: "Betreff [K7QW3M]",
      text: "Text",
    });
    expect(result.ok).toBe(true);

    // Verify the built message contains no Reply-To header and no tag in From
    const messageObj = JSON.parse(capturedMessage);
    expect(messageObj.replyTo).toBeUndefined();
    const fromStr = typeof messageObj.from === "string" ? messageObj.from : JSON.stringify(messageObj.from);
    expect(fromStr).not.toMatch(/\+/);
  });

  it("meldet einen Fehler statt zu werfen", async () => {
    const mailer = createJsonMailer("korrektur@example.tld");
    const result = await mailer.send({ to: "", subject: "x", text: "y" });
    expect(result.ok).toBe(false);
  });
});
