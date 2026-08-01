import nodemailer, { type Transporter } from "nodemailer";
import type { Env } from "../env.js";

const IMPLICIT_TLS_PORT = 465;

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
}

export type SendResult = { ok: true; messageId: string } | { ok: false; error: string };

export interface Mailer {
  send(message: OutgoingMail): Promise<SendResult>;
}

interface TransportInfo {
  messageId: string;
  /** Only set by the JSON transport — the fully built message. */
  message?: string;
}

function wrap(transport: Transporter<TransportInfo>, from: string, onMessage?: (raw: string) => void): Mailer {
  return {
    async send(message: OutgoingMail): Promise<SendResult> {
      if (message.to.trim().length === 0) {
        return { ok: false, error: "Kein Empfänger angegeben" };
      }
      try {
        // Bewusst ohne Reply-To: der Referenz-Token lebt im Betreff (§7).
        const info = await transport.sendMail({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
        });
        if (onMessage && info.message) {
          onMessage(info.message);
        }
        return { ok: true, messageId: info.messageId };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler" };
      }
    },
  };
}

export function createSmtpMailer(env: Env): Mailer {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === IMPLICIT_TLS_PORT,
    requireTLS: env.SMTP_PORT !== IMPLICIT_TLS_PORT,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  return wrap(transport, env.MAIL_FROM);
}

/** Baut die Nachricht vollständig, verschickt aber nichts — für Tests und Trockenläufe. */
export function createJsonMailer(from: string, onMessage?: (raw: string) => void): Mailer {
  return wrap(nodemailer.createTransport({ jsonTransport: true }), from, onMessage);
}
