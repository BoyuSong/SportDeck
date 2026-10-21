import { NextResponse } from "next/server";
import {
  getBearerTokenFromRequest,
  revokeToken,
  verifyRefreshToken,
  withAuth,
} from "@/utils/auth";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (request, payload) => {
  try {
    const accessToken = getBearerTokenFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as {
      refreshToken?: unknown;
    };

    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token" }, { status: 400 });
    }

    if (typeof payload.exp !== "number") {
      return NextResponse.json(
        { error: "Access token is missing expiration metadata" },
        { status: 500 }
      );
    }

    await revokeToken(accessToken, "ACCESS", new Date(payload.exp * 1000));

    if (typeof body.refreshToken === "string" && body.refreshToken.trim() !== "") {
      const refreshPayload = await verifyRefreshToken(body.refreshToken);

      if (!refreshPayload || refreshPayload.userId !== payload.userId || typeof refreshPayload.exp !== "number") {
        return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
      }

      await revokeToken(body.refreshToken, "REFRESH", new Date(refreshPayload.exp * 1000));
    }

    return NextResponse.json({ message: "Logged out successfully" }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
