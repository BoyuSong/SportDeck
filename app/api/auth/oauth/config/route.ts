import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      providers: {
        github: {
          enabled: Boolean(process.env.GITHUB_CLIENT_ID),
          clientId: process.env.GITHUB_CLIENT_ID ?? null,
        },
        google: {
          enabled: Boolean(process.env.GOOGLE_CLIENT_ID),
          clientId: process.env.GOOGLE_CLIENT_ID ?? null,
        },
      },
    },
    { status: 200 }
  );
}
