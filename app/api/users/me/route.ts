import { NextResponse } from "next/server";
import type { Prisma } from "@/prisma/generated/index.js";
import { withAuth } from "@/utils/auth";
import { prisma } from "@/prisma/client";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request, payload) => {
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      username: true,
      avatarUrl: true,
      favoriteTeamId: true,
      role: true,
      banStatus: true,
      banReason: true,
      bannedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user }, { status: 200 });
});

export const PATCH = withAuth(async (request, payload) => {
  const body = (await request.json()) as Record<string, unknown>;
  const { username, avatarUrl, favoriteTeamId } = body ?? {};

  const data: Prisma.UserUpdateInput = {};

  if (username !== undefined) {
    if (typeof username !== "string" || username.trim() === "") {
      return NextResponse.json(
        { error: "username must be a non-empty string" },
        { status: 400 }
      );
    }
    data.username = username.trim();
  }

  if (avatarUrl !== undefined) {
    if (avatarUrl !== null && (typeof avatarUrl !== "string" || avatarUrl.trim() === "")) {
      return NextResponse.json(
        { error: "avatarUrl must be a non-empty string or null" },
        { status: 400 }
      );
    }
    data.avatarUrl = avatarUrl ? avatarUrl.trim() : null;
  }

  if (favoriteTeamId !== undefined) {
    if (
      favoriteTeamId !== null &&
      (!Number.isInteger(favoriteTeamId) || (favoriteTeamId as number) <= 0)
    ) {
      return NextResponse.json(
        { error: "favoriteTeamId must be a positive integer or null" },
        { status: 400 }
      );
    }

    if (favoriteTeamId !== null) {
      const team = await prisma.team.findUnique({
        where: { id: favoriteTeamId as number },
        select: { id: true },
      });
      if (!team) {
        return NextResponse.json({ error: "favoriteTeamId not found" }, { status: 400 });
      }

      data.favoriteTeam = { connect: { id: favoriteTeamId as number } };
    } else {
      data.favoriteTeam = { disconnect: true };
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields provided to update" },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.update({
      where: { id: payload.userId },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        favoriteTeamId: true,
        role: true,
        banStatus: true,
        banReason: true,
        bannedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Username is already in use" },
        { status: 400 }
      );
    }

    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, { checkBan: false });
