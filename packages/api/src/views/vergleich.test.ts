import { describe, expect, it } from "vitest";
import { vergleicheFassungen } from "./vergleich.js";

describe("vergleicheFassungen", () => {
  it("zeigt einen Dreher als Tilgung plus Einfuegung", () => {
    expect(vergleicheFassungen("1969 landete Apollo 11", "1996 landete Apollo 11")).toEqual([
      { art: "getilgt", text: "1969" },
      { art: "eingefuegt", text: "1996" },
      { art: "gleich", text: "landete Apollo 11" },
    ]);
  });

  it("liefert bei wortgleichen Fassungen nur Gleiches", () => {
    expect(vergleicheFassungen("alles beim Alten", "alles  beim\nAlten")).toEqual([
      { art: "gleich", text: "alles beim Alten" },
    ]);
  });

  it("erkennt eine Auslassung", () => {
    expect(vergleicheFassungen("der sehr lange Satz", "der lange Satz")).toEqual([
      { art: "gleich", text: "der" },
      { art: "getilgt", text: "sehr" },
      { art: "gleich", text: "lange Satz" },
    ]);
  });

  it("erkennt eine Einfuegung am Ende", () => {
    expect(vergleicheFassungen("Apollo landete", "Apollo landete sanft")).toEqual([
      { art: "gleich", text: "Apollo landete" },
      { art: "eingefuegt", text: "sanft" },
    ]);
  });

  it("fasst mehrere getilgte Woerter zusammen", () => {
    expect(vergleicheFassungen("ganz falscher alter Text", "neuer Text")).toEqual([
      { art: "getilgt", text: "ganz falscher alter" },
      { art: "eingefuegt", text: "neuer" },
      { art: "gleich", text: "Text" },
    ]);
  });

  it("bleibt bei leeren Eingaben leer", () => {
    expect(vergleicheFassungen("", "")).toEqual([]);
  });
});
