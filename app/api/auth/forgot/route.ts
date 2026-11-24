import { randomBytes } from "node:crypto";
import { database } from "@/db/mysql";
import {
  allowAttempt,
  attemptLimits,
  clientIp,
  resetLinkMinutes,
  tokenHash,
} from "@/lib/auth";
import { mailConfigured, sendMail } from "@/lib/mail";
import { ApiError, assertOrigin, errorResponse } from "@/lib/server";
export const runtime = "nodejs";
/**
 * Emails a one-time password-reset link. The answer is the same whether or
 * not the email belongs to an admin, so the form cannot be used to discover
 * accounts. `email: false` means the site has no email service configured.
 */
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (Number(request.headers.get("content-length")) > 2048)
      throw new ApiError(413, "VALIDATION", "Request too large.");
    const input = (await request.json()) as { email?: unknown };
    if (typeof input?.email !== "string" || input.email.length > 254)
      throw new ApiError(400, "VALIDATION", "Enter your email.");
    const email = input.email.trim().toLowerCase();
    if (!(await allowAttempt(attemptLimits("forgot", email, clientIp(request)))))
      return Response.json(
        {
          error: "Too many attempts. Try again in 15 minutes.",
          code: "RATE_LIMITED",
        },
        { status: 429 },
      );
    if (!mailConfigured()) return Response.json({ ok: true, email: false });
    const user = await database
      .prepare("SELECT id FROM admins WHERE email=? AND active=1")
      .bind(email)
      .first<{ id: string }>();
    if (user) {
      const now = Date.now();
      const token = randomBytes(32).toString("hex");
      // Only the newest link works; expired links are cleared too.
      await database.batch([
        database
          .prepare("DELETE FROM password_resets WHERE expires_at<? OR admin_id=?")
          .bind(now, user.id),
        database
          .prepare(
            "INSERT INTO password_resets(token_hash,admin_id,expires_at) VALUES(?,?,?)",
          )
          .bind(tokenHash(token), user.id, now + resetLinkMinutes * 60 * 1000),
      ]);
      const origin = process.env.SITE_URL
        ? new URL(process.env.SITE_URL).origin
        : new URL(request.url).origin;
      const link = origin + "/admin/reset?token=" + token;
      try {
        await sendMail({
          to: email,
          subject:
            "Seshachandra Creations: reset your admin password / పాస్‌వర్డ్ రీసెట్",
          text: [
            "మీ నిర్వాహక పాస్‌వర్డ్‌ను మార్చడానికి ఈ లింక్‌ను తెరవండి:",
            "Open this link to choose a new admin password:",
            "",
            link,
            "",
            `ఈ లింక్ ${resetLinkMinutes} నిమిషాల్లో ముగుస్తుంది, ఒకసారి మాత్రమే పనిచేస్తుంది.`,
            `The link expires in ${resetLinkMinutes} minutes and works once.`,
            "",
            "మీరు అడగకపోతే ఈ ఈమెయిల్‌ను పట్టించుకోకండి; మీ పాస్‌వర్డ్ మారదు.",
            "If you did not ask for this, ignore this email; your password stays the same.",
          ].join("\n"),
        });
      } catch (e) {
        console.error(
          "Password reset email failed:",
          e instanceof Error ? e.message : e,
        );
        await database
          .prepare("DELETE FROM password_resets WHERE admin_id=?")
          .bind(user.id)
          .run();
        throw new ApiError(
          502,
          "MAIL_FAILED",
          "The email could not be sent. Try again later or use a recovery code.",
        );
      }
    }
    return Response.json({ ok: true, email: true });
  } catch (e) {
    return errorResponse(e);
  }
}
