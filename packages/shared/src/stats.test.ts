import { describe, expect, it } from "vitest";
import { rateOrNull, wilsonInterval } from "./stats.js";

describe("wilsonInterval", () => {
  it("reproduziert einen aus der Literatur bekannten Kontrollfall", () => {
    // Wilson-Score-Intervall fuer 40 von 100, 95 % — Standardwert aus der
    // Literatur. Verankert den Test an einer externen Quelle statt an der
    // eigenen Implementierung.
    const { lower, upper } = wilsonInterval(40, 100);
    expect(lower).toBeCloseTo(0.3094, 4);
    expect(upper).toBeCloseTo(0.498, 3);
  });

  it("liefert für 5 von 12 ein enges 95-%-Intervall", () => {
    const { lower, upper } = wilsonInterval(5, 12);
    expect(lower).toBeCloseTo(0.1933, 4);
    expect(upper).toBeCloseTo(0.6805, 4);
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
