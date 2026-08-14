import { describe, expect, it } from "vitest";
import { darfAbrufen, robotsWaechter } from "./robots.js";

const UNSER = "KorrekturTracker";

describe("darfAbrufen", () => {
  it("erlaubt, was nicht verboten ist", () => {
    expect(darfAbrufen("User-agent: *\nDisallow: /suche\n", "/politik/artikel-1", UNSER)).toBe(true);
  });

  it("achtet ein Verbot fuer alle", () => {
    expect(darfAbrufen("User-agent: *\nDisallow: /politik\n", "/politik/artikel-1", UNSER)).toBe(
      false,
    );
  });

  it("nimmt unsere eigene Gruppe, wenn es eine gibt", () => {
    const robots = "User-agent: *\nDisallow:\n\nUser-agent: KorrekturTracker\nDisallow: /\n";
    expect(darfAbrufen(robots, "/politik/artikel-1", UNSER)).toBe(false);
    expect(darfAbrufen(robots, "/politik/artikel-1", "AndererBot")).toBe(true);
  });

  it("laesst die genauere Regel gewinnen", () => {
    const robots = "User-agent: *\nDisallow: /politik\nAllow: /politik/artikel\n";
    expect(darfAbrufen(robots, "/politik/artikel-1", UNSER)).toBe(true);
    expect(darfAbrufen(robots, "/politik/uebersicht", UNSER)).toBe(false);
  });

  it("versteht ein leeres Disallow als Erlaubnis", () => {
    expect(darfAbrufen("User-agent: *\nDisallow:\n", "/beliebig", UNSER)).toBe(true);
  });

  it("erlaubt bei unlesbarer Datei -- nie stillschweigend abschalten", () => {
    expect(darfAbrufen("", "/politik/artikel-1", UNSER)).toBe(true);
    expect(darfAbrufen("<html>404</html>", "/politik/artikel-1", UNSER)).toBe(true);
  });
});

describe("robotsWaechter", () => {
  it("holt je Domain einmal und merkt sich die Antwort", async () => {
    let abrufe = 0;
    const waechter = robotsWaechter({
      holeText: async () => {
        abrufe += 1;
        return "User-agent: *\nDisallow: /gesperrt\n";
      },
      now: () => 1_000_000,
    });

    expect(await waechter.darf("https://a.test/frei/artikel")).toBe(true);
    expect(await waechter.darf("https://a.test/gesperrt/artikel")).toBe(false);
    expect(abrufe).toBe(1);

    await waechter.darf("https://b.test/frei");
    expect(abrufe).toBe(2);
  });

  it("ruft nach einem Tag neu ab", async () => {
    let abrufe = 0;
    let jetzt = 1_000_000;
    const waechter = robotsWaechter({
      holeText: async () => {
        abrufe += 1;
        return "User-agent: *\nDisallow:\n";
      },
      now: () => jetzt,
    });
    await waechter.darf("https://a.test/x");
    jetzt += 86_400 + 1;
    await waechter.darf("https://a.test/x");
    expect(abrufe).toBe(2);
  });

  it("erlaubt, wenn die Datei nicht zu holen ist", async () => {
    const waechter = robotsWaechter({
      holeText: async () => {
        throw new Error("Netz weg");
      },
      now: () => 1_000_000,
    });
    expect(await waechter.darf("https://a.test/artikel")).toBe(true);
  });
});
