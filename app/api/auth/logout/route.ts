import { cookies } from "next/headers";
import { database } from "@/db/mysql";
import { sessionCookie, tokenHash } from "@/lib/auth";
import { assertOrigin, errorResponse } from "@/lib/server";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const jar = await cookies();
    const token = jar.get(sessionCookie)?.value;
    if (token)
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
