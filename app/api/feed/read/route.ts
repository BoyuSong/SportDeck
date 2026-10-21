import { NextResponse } from "next/server";
import { withAuth } from "@/utils/auth";
import { markFeedGroupAsRead } from "@/utils/feed";

export const POST = withAuth(async (request, payload) => {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const groupKey = typeof body.groupKey === "string" ? body.groupKey.trim() : "";

    if (!groupKey) {
      return NextResponse.json({ error: "groupKey is required" }, { status: 400 });
    }

    const state = await markFeedGroupAsRead(payload.userId, groupKey);
    return NextResponse.json({ state }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("groupKey")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, { checkBan: true });
