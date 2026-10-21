import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/prisma/client";
import { issueTokens, revokeToken, verifyRefreshToken } from "@/utils/auth";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const refreshToken = body?.refreshToken;

    // Validate input
    if (typeof refreshToken !== "string" || refreshToken === "") {
      return jsonError("Refresh token is required", 401);
    }

    let payload;
    try {
      payload = await verifyRefreshToken(refreshToken);
    } catch {
      return jsonError("Invalid or expired refresh token", 401);
    }

    if (!payload) {
      return jsonError("Invalid refresh token payload", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, username: true, role: true },
    });

    if (!user) {
      return jsonError("User not found", 401);
    }

    const { accessToken, refreshToken: nextRefreshToken, accessExpiresAtMs, refreshExpiresAtMs } =
      issueTokens(user);

    await revokeToken(refreshToken, "REFRESH", new Date(payload.exp! * 1000));

    return NextResponse.json(
      {
        accessToken,
        refreshToken: nextRefreshToken,
        accessTokenExpiresAt: new Date(accessExpiresAtMs).toISOString(),
        refreshTokenExpiresAt: new Date(refreshExpiresAtMs).toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}
