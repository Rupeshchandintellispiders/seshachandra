import "./load-env";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing email over SMTP, used for password-reset links. Works with any
 * provider that offers SMTP (Gmail app passwords, Zoho, Brevo, Resend, ...).
 * Email is optional: without SMTP settings the reset-by-email option reports
 * itself unavailable and recovery codes remain.
 */
export function mailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

let transport: Transporter | undefined;
function transporter() {
  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT || 587);
  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  return (transport ??= nodemailer.createTransport({
    host,
    port,
    // Port 465 uses TLS from the start; other ports must upgrade with
    // STARTTLS. Only a local test server may skip encryption.
    secure: port === 465,
    requireTLS: !local && port !== 465,
    ...(process.env.SMTP_USER
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD || "",
          },
        }
      : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  }));
}

export async function sendMail(message: {
  to: string;
  subject: string;
  text: string;
}) {
  await transporter().sendMail({ from: process.env.SMTP_FROM, ...message });
}
