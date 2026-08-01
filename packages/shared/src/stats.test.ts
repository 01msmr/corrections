import { describe, expect, it } from "vitest";
import { rateOrNull, wilsonInterval } from "./stats.js";

describe("wilsonInterval", () => {
  it("liefert für 5 von 12 ein plausibles 95-%-Intervall", () => {
    const { lower, upper } = wilsonInterval(5, 12);
    expect(lower).toBeCloseTo(0.1979, 3);
    expect(upper).toBeCloseTo(0.6816, 3);
  });

  it("gibt bei n=0 das volle Intervall zurück", () => {
    expect(wilsonInterval(0, 0)).toEqual({ lower: 0, upper: 1 });
  });

  it("zieht die untere Grenze bei 1 von 1 deutlich unter 1", () => {
    const { lower, upper } = wilsonInterval(1, 1);
    expect(lower).toBeLessThan(0.3);
    expect(upper).toBe(1);
  });
});

describe("rateOrNull", () => {
  it("unterdrückt Quoten unterhalb der Mindestfallzahl", () => {
    expect(rateOrNull(4, 9)).toBeNull();
  });

  it("liefert die Quote ab der Mindestfallzahl", () => {
    expect(rateOrNull(5, 10)).toBeCloseTo(0.5, 6);
  });

  it("gibt bei n=0 null zurück", () => {
    expect(rateOrNull(0, 0)).toBeNull();
  });
});
