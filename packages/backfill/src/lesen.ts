import PostalMime from "postal-mime";
import { parseVorlage, type VorlagenErgebnis } from "./vorlage.js";

/**
 * MIME-Schicht ueber dem Vorlagen-Parser: entpackt eine .eml (Kodierung,
 * Multipart) und reicht Betreff und text/plain-Teil an die reine
 * Parse-Funktion weiter. Die sicheren Header-Felder (§11.2) kommen mit.
 */
export interface Altmeldung extends VorlagenErgebnis {
  messageId: string | null;
  gesendetAm: Date | null;
  empfaenger: string | null;
  betreff: string | null;
  /** Entschluesselter text/plain-Teil — fuer die Gegenpruefung in der Review. */
  text: string;
}

export async function leseAltmeldung(eml: Uint8Array | string): Promise<Altmeldung> {
  const mail = await PostalMime.parse(eml);
  const betreff = mail.subject ?? null;
  const felder = parseVorlage(betreff ?? "", mail.text ?? "");
  const datum = mail.date ? new Date(mail.date) : null;
  return {
    ...felder,
    messageId: mail.messageId ?? null,
    gesendetAm: datum && !Number.isNaN(datum.getTime()) ? datum : null,
    empfaenger: mail.to?.[0]?.address ?? null,
    betreff,
    text: mail.text ?? "",
  };
}
