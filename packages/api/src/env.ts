import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().min(1).default("./data/korrektur.db"),
  /** Explizit, weil das CJS-Buendel kein import.meta.url kennt (Task 7). */
  MIGRATIONS_DIR: z.string().min(1).default("./packages/api/src/db/migrations"),
  ADMIN_USER: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(8),
  PUBLIC_BASE_URL: z.string().url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  MAIL_FROM: z.string().email(),
  /* IMAP nur fuer den Worker (Bestaetigungen aufraeumen; spaeter Abgleich).
     Optional: ohne IMAP_HOST ueberspringt der Worker den Schritt sauber. */
  IMAP_HOST: z.string().min(1).optional(),
  IMAP_PORT: z.coerce.number().int().positive().default(993),
  IMAP_USER: z.string().min(1).optional(),
  IMAP_PASSWORD: z.string().min(1).optional(),
  IMAP_TRASH: z.string().min(1).default("Trash"),
  /* Rechtschreib- und Grammatikpruefung. Vorgabe ist die oeffentliche API;
     eine eigene Instanz (LGPL, Docker) traegt man hier ein, ohne Code zu
     aendern. */
  LANGUAGETOOL_URL: z.string().url().default("https://api.languagetool.org/v2/check"),
  LANGUAGETOOL_SPRACHE: z.string().min(2).default("de-DE"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Unvollständige oder ungültige Umgebung: ${fields}`);
  }
  return parsed.data;
}
