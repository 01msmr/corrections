import { describe, expect, it } from "vitest";
import { diffWords } from "./diff.js";

/** Verdichtet das Ergebnis auf die hervorgehobenen Woerter. */
function changed(segments: { text: string; changed: boolean }[]): string[] {
  return segments.filter((s) => s.changed).map((s) => s.text);
}

describe("diffWords", () => {
  it("hebt nur das abweichende Wort hervor", () => {
    const { before, after } = diffWords(
      "Es wurden rund 4,2 Millionen Menschen gezählt.",
      "Es wurden rund 2,4 Millionen Menschen gezählt.",
    );
    expect(changed(before)).toEqual(["4,2"]);
    expect(changed(after)).toEqual(["2,4"]);
  });

  it("gibt den vollstaendigen Satz zurueck, nicht nur die Abweichung", () => {
    const { before, after } = diffWords("Der Test ist gut.", "Der Test ist schlecht.");
    expect(before.map((s) => s.text).join("")).toBe("Der Test ist gut.");
    expect(after.map((s) => s.text).join("")).toBe("Der Test ist schlecht.");
  });

  it("erkennt ein eingefuegtes Wort", () => {
    const { before, after } = diffWords("Der Test ist gut.", "Der neue Test ist gut.");
    expect(changed(before)).toEqual([]);
    expect(changed(after)).toEqual(["neue"]);
  });

  it("erkennt ein entferntes Wort", () => {
    const { before, after } = diffWords("Der neue Test ist gut.", "Der Test ist gut.");
    expect(changed(before)).toEqual(["neue"]);
    expect(changed(after)).toEqual([]);
  });

  it("markiert bei voelliger Verschiedenheit alles", () => {
    const { before, after } = diffWords("Alpha Beta", "Gamma Delta");
    expect(changed(before)).toEqual(["Alpha", "Beta"]);
    expect(changed(after)).toEqual(["Gamma", "Delta"]);
  });

  it("ignoriert Typografie beim Vergleich, erhaelt sie aber in der Ausgabe", () => {
    // „ und " sind derselbe Inhalt; nur die Zahl unterscheidet sich wirklich.
    const { before, after } = diffWords('Er sagte "vier" laut.', "Er sagte „fünf“ laut.");
    expect(changed(before)).toEqual(['"vier"']);
    expect(changed(after)).toEqual(["„fünf“"]);
  });

  it("kommt mit leeren Eingaben zurecht", () => {
    expect(diffWords("", "")).toEqual({ before: [], after: [] });
  });

  it("behaelt Mehrfach-Leerzeichen im Ausgabetext", () => {
    const { before } = diffWords("a  b", "a b");
    expect(before.map((s) => s.text).join("")).toBe("a  b");
  });
});
