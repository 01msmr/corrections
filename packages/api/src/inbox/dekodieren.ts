/**
 * Quoted-Printable, wie Mailtexte es tragen: Umlaute als `=C3=BC`, lange
 * Zeilen mit einem `=` am Ende umgebrochen. Ohne Dekodieren greift kein
 * Muster mit Umlaut, und jede Wendung kann mitten im Wort zerrissen sein.
 *
 * Rein, ohne IO. Unversehrter Text bleibt unversehrt.
 */
export function dekodiereQuotedPrintable(roh: string): string {
  const ohneWeicheUmbrueche = roh.replace(/=\r?\n/g, "");
  const bytes: number[] = [];

  for (let i = 0; i < ohneWeicheUmbrueche.length; i += 1) {
    const zeichen = ohneWeicheUmbrueche[i] ?? "";
    const paar = ohneWeicheUmbrueche.slice(i + 1, i + 3);
    if (zeichen === "=" && /^[0-9a-f]{2}$/i.test(paar)) {
      bytes.push(Number.parseInt(paar, 16));
      i += 2;
      continue;
    }
    for (const byte of Buffer.from(zeichen, "utf8")) bytes.push(byte);
  }

  return Buffer.from(bytes).toString("utf8");
}
