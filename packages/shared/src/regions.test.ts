import { describe, expect, it } from "vitest";
import { REGION_GROUPS, regionOptionGroups } from "./regions.js";

describe("regionOptionGroups", () => {
  it("stellt den deutschsprachigen Raum voran, dann Europa", () => {
    const groups = regionOptionGroups();
    expect(groups[0]?.label).toBe("Deutschsprachig");
    expect(groups[1]?.label).toBe("Europa");
  });

  it("enthält UK und die Schweiz", () => {
    const alle = regionOptionGroups().flatMap((g) => g.options.map((o) => o.code));
    expect(alle).toContain("GB");
    expect(alle).toContain("CH");
  });

  it("löst die Kürzel gegen deutsche Namen auf", () => {
    const deutschsprachig = regionOptionGroups()[0]?.options ?? [];
    expect(deutschsprachig.find((o) => o.code === "CH")?.name).toBe("Schweiz");
    expect(deutschsprachig.find((o) => o.code === "DE")?.name).toBe("Deutschland");
  });

  it("behält die gepflegte Reihenfolge, sortiert nicht alphabetisch", () => {
    // Deutschland vor Liechtenstein: alphabetisch waere es umgekehrt.
    const codes = (regionOptionGroups()[0]?.options ?? []).map((o) => o.code);
    expect(codes).toEqual(["DE", "AT", "CH", "LI", "LU"]);
  });

  it("stellt in Europa die grossen Sprachraeume voran", () => {
    const codes = (regionOptionGroups()[1]?.options ?? []).map((o) => o.code);
    expect(codes.slice(0, 4)).toEqual(["GB", "FR", "IT", "ES"]);
    expect(codes.indexOf("GB")).toBeLessThan(codes.indexOf("AD"));
  });

  it("vergibt jedes Kürzel nur einmal", () => {
    const alle = REGION_GROUPS.flatMap((g) => g.codes);
    expect(new Set(alle).size).toBe(alle.length);
  });

  it("behält einen bereits erfassten Wert, der nicht in der Liste steht", () => {
    const groups = regionOptionGroups("de", "gl");
    expect(groups.at(-1)?.options[0]?.code).toBe("GL");
  });

  it("hängt einen bekannten Wert nicht zusätzlich an", () => {
    const groups = regionOptionGroups("de", "DE");
    expect(groups.some((g) => g.label === "Bereits erfasst")).toBe(false);
  });
});
