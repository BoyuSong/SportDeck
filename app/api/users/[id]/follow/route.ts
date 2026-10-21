import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";

export const dynamic = "force-dynamic";

export const POST = withAuth(
  async (request, payload, { params }) => {
    const { id } = await params;
    const targetUserId = Number(id);

    if (Number.isNaN(targetUserId)) {
      return NextResponse.json(
        { error: "Invalid user id" },
        { status: 400 }
      );
    }

    if (targetUserId === payload.userId) {
      return NextResponse.json(
        { error: "You cannot follow yourself" },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: payload.userId,
          followingId: targetUserId,
        },
      },
    });

    if (existingFollow) {
      return NextResponse.json(
        { error: "You are already following this user" },
        { status: 409 }
      );
    }

    const follow = await prisma.follow.create({
      data: {
        followerId: payload.userId,
        followingId: targetUserId,
      },
    });

    return NextResponse.json(
      {
        message: "Followed successfully",
        follow,
      },
      { status: 201 }
    );
  },
  { checkBan: true }
);

export const DELETE = withAuth(
  async (request, payload, { params }) => {
    const { id } = await params;
    const targetUserId = Number(id);

    if (Number.isNaN(targetUserId)) {
      return NextResponse.json(
        { error: "Invalid user id" },
        { status: 400 }
      );
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: payload.userId,
          followingId: targetUserId,
        },
      },
    });

    if (!existingFollow) {
      return NextResponse.json(
        { error: "You are not following this user" },
        { status: 404 }
      );
    }

    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: payload.userId,
          followingId: targetUserId,
        },
      },
    });

    return NextResponse.json(
      { message: "Unfollowed successfully" },
      { status: 200 }
    );
  },
  { checkBan: true }
);
