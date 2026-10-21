import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";

export const dynamic = "force-dynamic";

export const DELETE = withAuth(
  async (request, payload, { params }) => {
    const { id } = await params;
    const followerUserId = Number(id);

    if (Number.isNaN(followerUserId)) {
      return NextResponse.json(
        { error: "Invalid follower user id" },
        { status: 400 }
      );
    }

    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: followerUserId,
          followingId: payload.userId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "This user is not following you" },
        { status: 404 }
      );
    }

    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: followerUserId,
          followingId: payload.userId,
        },
      },
    });

    return NextResponse.json(
      { message: "Follower removed successfully" },
      { status: 200 }
    );
  },
  { checkBan: true }
);
