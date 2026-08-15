import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Farbwerte gehören ausschließlich in `packages/shared/src/constants.ts`
 * (PALETTE / PALETTE_DUNKEL). Überall sonst wird von dort bezogen — auch in
 * Tests, sonst muss eine Farbänderung wieder mehrere Dateien anfassen.
 *
 * Erfasst werden Hex-Farben (#rrggbb, #rrggbbaa) und rgb()/rgba() mit
 * Zahlenwerten. `rgb(var(--schatten) / .35)` bleibt erlaubt: dort steckt der
 * Wert in der Variablen.
 */
const FARBLITERAL = String.raw`#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?\b|rgba?\(\s*[0-9.]`;
const FARB_MELDUNG =
  "Farbwert als Literal. Farben stehen in PALETTE/PALETTE_DUNKEL " +
  "(packages/shared/src/constants.ts) und werden von dort bezogen.";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/build/**", "**/migrations/**", "fixtures.local/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=/${FARBLITERAL}/]`, message: FARB_MELDUNG },
        { selector: `TemplateElement[value.raw=/${FARBLITERAL}/]`, message: FARB_MELDUNG },
      ],
    },
  },
  {
    // Die eine Stelle, an der Farbwerte stehen dürfen — und übernommener
    // Fremdcode, dessen Werte ohnehin überschrieben werden.
    files: ["packages/shared/src/constants.ts", "**/views/vendor/**"],
    rules: { "no-restricted-syntax": "off" },
  },
);
