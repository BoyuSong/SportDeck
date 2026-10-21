import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@/prisma/generated/index.js";
import { prisma } from "@/prisma/client";
import { getOrSetJson } from "@/utils/cache";

export const dynamic = "force-dynamic";

type StandingsPayload = {
  competition?: unknown;
  competitionCode?: unknown;
  season?: unknown;
  source?: unknown;
  standings?: unknown;
};

function parseSnapshotPayload(value: Prisma.JsonValue): StandingsPayload {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as unknown as StandingsPayload;
  }

  return {};
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season = searchParams.get("season")?.trim() || null;

    const cacheKey = `league:standings:v1:${season ?? "latest"}`;
    const { status, value } = await getOrSetJson(cacheKey, async () => {
      const snapshot = await prisma.standingsSnapshot.findFirst({
        where: season ? { season } : undefined,
        orderBy: { fetchedAt: "desc" },
        select: {
          id: true,
          season: true,
          fetchedAt: true,
          data: true,
        },
      });

      if (!snapshot) {
        throw new Error(season ? `No standings found for season '${season}'` : "No standings data found");
      }

      const payload = parseSnapshotPayload(snapshot.data);

      return {
        snapshot: {
          id: snapshot.id,
          season: snapshot.season,
          fetchedAt: snapshot.fetchedAt,
          source: payload.source ?? null,
          competitionCode: payload.competitionCode ?? null,
          competition: payload.competition ?? null,
          seasonMeta: payload.season ?? null,
          standings: Array.isArray(payload.standings) ? payload.standings : [],
        },
      };
    });

    return NextResponse.json(value, {
      status: 200,
      headers: { "X-Cache": status },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("No standings")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
