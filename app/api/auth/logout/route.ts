import { cookies } from "next/headers";
import { database } from "@/db/mysql";
import { currentAdmin, sessionCookie, tokenHash } from "@/lib/auth";
import { assertOrigin, errorResponse } from "@/lib/server";
export const runtime = "nodejs";
/** Signs out this browser, or every device when `{ everywhere: true }`. */
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const input = (await request.json().catch(() => ({}))) as {
      everywhere?: unknown;
    };
    const jar = await cookies();
    const token = jar.get(sessionCookie)?.value;
    const user = input?.everywhere === true ? await currentAdmin() : null;
    if (user)
      await database
        .prepare("DELETE FROM admin_sessions WHERE admin_id=?")
        .bind(user.userId)
        .run();
    else if (token)
      await database
        .prepare("DELETE FROM admin_sessions WHERE token_hash=?")
        .bind(tokenHash(token))
        .run();
    jar.set(sessionCookie, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
