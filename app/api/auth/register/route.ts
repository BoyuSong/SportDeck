import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcrypt";
import type { Prisma } from "@/prisma/generated/index.js";
import { prisma } from "@/prisma/client";
import { issueTokens } from "@/utils/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, username } = body ?? {};

    if (typeof email !== "string" || email.trim() === "") {
      return NextResponse.json(
        { error: "Email is required and must be a string" },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password === "") {
      return NextResponse.json(
        { error: "Password is required and must be a string" },
        { status: 400 }
      );
    }

    if (typeof username !== "string" || username.trim() === "") {
      return NextResponse.json(
        { error: "Username is required and must be a string" },
        { status: 400 }
      );
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        username: username.trim(),
        passwordHash: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    const { accessToken, refreshToken, accessExpiresAtMs } =
      issueTokens(newUser);

    return NextResponse.json(
      {
        message: "User registered successfully",
        user: newUser,
        accessToken,
        refreshToken,
        accessTokenExpiresAt: new Date(accessExpiresAtMs).toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const prismaError = error as Prisma.PrismaClientKnownRequestError;
      const target = Array.isArray(prismaError.meta?.target)
        ? prismaError.meta.target.join(", ")
        : "field";
      return NextResponse.json(
        { error: `A user already exists with that ${target}` },
        { status: 400 }
      );
    }

    console.error(error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
