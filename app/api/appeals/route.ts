import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (request, payload) => {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = String(body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      banStatus: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.banStatus !== "BANNED") {
    return NextResponse.json(
      { error: "Only banned users can submit an appeal" },
      { status: 403 }
    );
  }

  const existingOpenAppeal = await prisma.appeal.findFirst({
    where: {
      userId: payload.userId,
      status: "OPEN",
    },
  });

  if (existingOpenAppeal) {
    return NextResponse.json(
      { error: "You already have an open appeal", appealId: existingOpenAppeal.id },
      { status: 409 }
    );
  }

  const appeal = await prisma.appeal.create({
    data: {
      userId: payload.userId,
      message,
      status: "OPEN",
    },
  });

  return NextResponse.json(appeal, { status: 201 });
});