import { describe, expect, it } from "vitest";
import {
  ANCHOR_LENGTH,
  CONFIDENCE_Z,
  MATURITY_DAYS,
  MATURITY_SECONDS,
  MIN_N_FOR_RATE,
  QUOTE_MAX_LENGTH,
} from "./constants.js";

describe("constants", () => {
  it("hält die in der Spec festgelegten Werte", () => {
    expect(MATURITY_DAYS).toBe(14);
    expect(MIN_N_FOR_RATE).toBe(10);
    expect(CONFIDENCE_Z).toBeCloseTo(1.96, 2);
    expect(QUOTE_MAX_LENGTH).toBe(280);
    expect(ANCHOR_LENGTH).toBe(48);
  });

  it("leitet die Reifegrenze in Sekunden aus den Tagen ab", () => {
    expect(MATURITY_SECONDS).toBe(MATURITY_DAYS * 24 * 60 * 60);
  });
});
