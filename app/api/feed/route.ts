import { NextResponse } from "next/server";
import { withAuth } from "@/utils/auth";
import { getGroupedFeedForUser } from "@/utils/feed";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request, payload) => {
  try {
    const { searchParams } = new URL(request.url);
    const feed = await getGroupedFeedForUser(payload.userId, searchParams);
    return NextResponse.json(feed, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("must be")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, { checkBan: true });
