import { randomBytes } from "node:crypto";
import { database } from "@/db/mysql";
import {
  inviteHours,
  maxPendingInvites,
  normalEmail,
  tokenHash,
  validEmail,
} from "@/lib/auth";
import { ApiError, errorResponse, requireAdmin } from "@/lib/server";
import { mailConfigured, sendMail } from "@/lib/mail";
export const runtime = "nodejs";
/**
 * Creates a one-time admin sign-up link for one email address. The link is
 * emailed to the invitee when SMTP is set up, and always returned once so the
 * inviter can share it another way. Only its hash is stored; inviting the same
 * email again replaces the earlier link.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    if (Number(request.headers.get("content-length")) > 2048)
      throw new ApiError(413, "VALIDATION", "Request too large.");
    const input = (await request.json()) as { email?: unknown };
    if (!validEmail(input?.email))
      throw new ApiError(400, "INVALID_EMAIL", "Enter a valid email address.");
    const email = normalEmail(input.email);
    if (
      await database
        .prepare("SELECT id FROM admins WHERE email=?")
        .bind(email)
        .first()
    )
      throw new ApiError(
        409,
        "EMAIL_TAKEN",
        "This email already belongs to an admin.",
      );
    const now = Date.now();
    await database
      .prepare("DELETE FROM admin_invites WHERE expires_at<? OR email=?")
      .bind(now, email)
      .run();
    const pending = await database
      .prepare("SELECT count(*) AS n FROM admin_invites")
      .first<{ n: number }>();
    if (Number(pending?.n || 0) >= maxPendingInvites)
      throw new ApiError(
        400,
        "TOO_MANY_INVITES",
        `There are already ${maxPendingInvites} pending invites. Cancel some first.`,
      );
    const token = randomBytes(32).toString("hex");
    const id = crypto.randomUUID();
    const expiresAt = now + inviteHours * 60 * 60 * 1000;
    await database
      .prepare(
        "INSERT INTO admin_invites(id,token_hash,email,invited_by,created_at,expires_at) VALUES(?,?,?,?,?,?)",
      )
      .bind(id, tokenHash(token), email, user.userId, now, expiresAt)
      .run();
    const origin = process.env.SITE_URL
      ? new URL(process.env.SITE_URL).origin
      : new URL(request.url).origin;
    const link = origin + "/admin/signup?token=" + token;
    // A failed email does not undo the invite: the link is still shown.
    let emailed = false;
    if (mailConfigured()) {
      try {
        await sendMail({
          to: email,
          subject:
            "Seshachandra Creations: you're invited to manage the site / నిర్వహణకు ఆహ్వానం",
          text: [
            "శేషచంద్ర క్రియేషన్స్ వెబ్‌సైట్ నిర్వహణకు మిమ్మల్ని ఆహ్వానించారు.",
            "You've been invited to help manage the Seshachandra Creations website.",
            "",
            "ఈ లింక్ తెరిచి మీ పాస్‌వర్డ్ ఎంచుకోండి:",
            "Open this link and choose your password:",
            "",
            link,
            "",
            `ఈ లింక్ ${inviteHours} గంటల్లో ముగుస్తుంది, ఒకసారి మాత్రమే పనిచేస్తుంది.`,
            `The link expires in ${inviteHours} hours and works once.`,
            "",
            "మీకు ఈ ఆహ్వానం గురించి తెలియకపోతే, ఈ ఈమెయిల్‌ను పట్టించుకోకండి.",
            "If you weren't expecting this, you can ignore this email.",
          ].join(String.fromCharCode(10)),
        });
        emailed = true;
      } catch (e) {
        console.error(
          "Invite email failed:",
          e instanceof Error ? e.message : e,
        );
      }
    }
    return Response.json(
      {
        id,
        email,
        expiresAt,
        link,
        emailed,
        mailConfigured: mailConfigured(),
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
