import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const digest = await prisma.thread.findFirst({
    where: {
      type: "GENERAL",
      title: `Daily Digest - ${today}`,
    },
    include: {
      posts: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!digest) {
    return NextResponse.json(
      { error: "Today's digest not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(digest, { status: 200 });
}
