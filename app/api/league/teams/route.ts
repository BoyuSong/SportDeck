import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import { getOrSetJson } from "@/utils/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { status, value } = await getOrSetJson("league:teams:v1", async () => {
      const teams = await prisma.team.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          externalId: true,
          name: true,
          shortName: true,
          crestUrl: true,
          venue: true,
          updatedAt: true,
        },
      });

      return { total: teams.length, teams };
    });

    return NextResponse.json(value, {
      status: 200,
      headers: { "X-Cache": status },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
