import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/prisma/client";
import { issueTokens } from "@/utils/auth";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body ?? {};

    // Validate input
    if (typeof email !== "string" || email.trim() === "") {
      return jsonError("email is required and must be a string", 400);
    }
    if (typeof password !== "string" || password === "") {
      return jsonError("password is required and must be a string", 400);
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "This account uses third-party sign-in. Please continue with Google or GitHub." },
        { status: 401 }
      );
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const { accessToken, refreshToken, accessExpiresAtMs } =
      issueTokens(user);

    return NextResponse.json(
      {
        accessToken,
        refreshToken,
        accessTokenExpiresAt: new Date(accessExpiresAtMs).toISOString(),
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
