//translate a post or comment written in a different language into English
import { NextResponse } from "next/server";
import { translateText } from "@/utils/ai";
import { withAuth } from "@/utils/auth";
export const dynamic = "force-dynamic";


export const POST = withAuth(
  async (request) => {
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    const text = String(body.text ?? "").trim();
    const source = body.source ?? "Auto Detect";
    const target = body.target ?? "English";

    if (!text) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }

    try {
      const result = await translateText({
        text,
        source,
        target,
      });

      return NextResponse.json(
        {
          originalText: text,
          translatedText: result.translatedText,
          source,
          target,
        },
        { status: 200 }
      );
    } catch (err) {
      return NextResponse.json(
        {
          error: "Translation failed",
          details: err instanceof Error ? err.message : "Unknown translation error",
        },
        { status: 502 }
      );
    }
  },
  { checkBan: true }
);
