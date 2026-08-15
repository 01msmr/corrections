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

/** Ein Abschnitt einer mehrteiligen Mail: Kopfzeilen und Rumpf. */
interface Teil {
  kopf: string;
  rumpf: string;
}

/**
 * Eine Grenzzeile: zwei Striche und eine Marke. Die Marke darf selbst mit
 * Strichen anfangen (`--==_mimepart_…`), muss aber irgendwo ein anderes
 * Zeichen tragen -- sonst hielte die Zerlegung jede Trennlinie im Text fuer
 * eine Grenze.
 */
const GRENZE = /^--(?=[^\s]*[^\s-])[^\s]+\s*$/m;

/** Kopfzeilen erkennt man an ihnen, nicht an der ersten Leerzeile. */
const KOPFZEILE = /^content-(type|transfer-encoding|disposition):/im;

function zerlegeInTeile(roh: string): Teil[] {
  const grenze = GRENZE.exec(roh);
  /* Ohne Grenze bleibt der Text ganz -- Kopfzeilen aber trotzdem abtrennen,
     sonst stehen sie im Auszug und die Kodierung wird nicht erkannt. */
  if (!grenze) {
    const trennung = roh.search(/\r?\n\r?\n/);
    if (trennung < 0 || !KOPFZEILE.test(roh.slice(0, trennung))) {
      return [{ kopf: "", rumpf: roh }];
    }
    return [
      {
        kopf: roh.slice(0, trennung),
        rumpf: roh.slice(trennung).replace(/^\r?\n\r?\n/, ""),
      },
    ];
  }

  const marke = grenze[0].trim().replace(/--$/, "");
  return roh
    .split(new RegExp(`^${marke.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(--)?\\s*$`, "m"))
    .filter((stueck): stueck is string => typeof stueck === "string" && stueck.trim().length > 0)
    .map((stueck) => {
      const trennung = stueck.search(/\r?\n\r?\n/);
      if (trennung < 0) return { kopf: "", rumpf: stueck };
      return {
        kopf: stueck.slice(0, trennung),
        rumpf: stueck.slice(trennung).replace(/^\r?\n\r?\n/, ""),
      };
    });
}

/**
 * Der lesbare Text einer Mail: aus einer mehrteiligen Nachricht der
 * text/plain-Abschnitt, dekodiert nach seiner Transfer-Kodierung. Ohne das
 * stehen Grenzmarken, Kopfzeilen und base64-Bloecke im Auszug der Historie.
 */
export function lesbarerText(roh: string): string {
  const teile = zerlegeInTeile(roh);
  const gewaehlt =
    teile.find((t) => /content-type:\s*text\/plain/i.test(t.kopf)) ?? teile[0];
  if (!gewaehlt) return roh.trim();

  const kodierung = /content-transfer-encoding:\s*(\S+)/i.exec(gewaehlt.kopf)?.[1]?.toLowerCase();
  if (kodierung === "base64") {
    return Buffer.from(gewaehlt.rumpf.replace(/\s+/g, ""), "base64")
      .toString("utf8")
      .replace(/\r\n/g, "\n")
      .trim();
  }
  const text = kodierung === "quoted-printable" ? dekodiereQuotedPrintable(gewaehlt.rumpf) : gewaehlt.rumpf;
  return text.replace(/\r\n/g, "\n").trim();
}
