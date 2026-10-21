import { PrismaClient, type Prisma } from "../prisma/generated/index.js";

const API_BASE = "https://api.football-data.org/v4";
const prisma = new PrismaClient();

type FootballDataCompetition = {
  code?: string;
  id?: number;
  name?: string;
};

type FootballDataMatch = {
  awayTeam?: { id?: number };
  homeTeam?: { id?: number };
  id: number;
  matchday?: number | null;
  score?: {
    fullTime?: {
      away?: number | null;
      home?: number | null;
    };
  };
  stage?: string | null;
  status?: string | null;
  utcDate: string;
  venue?: string | null;
};

type FootballDataResponse<T> = T & {
  competition?: FootballDataCompetition;
  season?: FootballDataSeason | null;
};

type FootballDataSeason = {
  currentMatchday?: number | null;
  endDate?: string;
  startDate?: string;
};

type FootballDataStandingsPayload = FootballDataResponse<{
  standings?: unknown[];
}>;

type FootballDataTeam = {
  crest?: string | null;
  id: number;
  name: string;
  shortName?: string | null;
  tla?: string | null;
  venue?: string | null;
};

type FootballDataTeamsPayload = FootballDataResponse<{
  teams?: FootballDataTeam[];
}>;

type FootballDataMatchesPayload = FootballDataResponse<{
  matches?: FootballDataMatch[];
}>;

type StoredMatch = {
  awayTeamId: number;
  externalId: number;
  homeTeamId: number;
  lastFetchedAt: Date;
  matchday: number | null;
  scoreAway: number | null;
  scoreHome: number | null;
  stage: string | null;
  status: string;
  utcDate: Date;
  venue: string | null;
};

function buildSeasonLabel(seasonObj: FootballDataSeason | null | undefined) {
  if (!seasonObj) return "unknown";
  if (seasonObj.startDate && seasonObj.endDate) {
    const startYear = new Date(seasonObj.startDate).getUTCFullYear();
    const endYear = new Date(seasonObj.endDate).getUTCFullYear();
    if (!Number.isNaN(startYear) && !Number.isNaN(endYear)) {
      return `${startYear}/${endYear}`;
    }
  }
  if (seasonObj.currentMatchday) {
    return `matchday-${seasonObj.currentMatchday}`;
  }
  return "unknown";
}

async function fetchFromFootballData<T extends object>(
  path: string,
  params: Record<string, string | null | undefined> = {}
): Promise<T> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("Missing FOOTBALL_DATA_API_KEY environment variable");
  }

  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      "X-Auth-Token": apiKey,
    },
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `football-data.org request failed (${response.status} ${response.statusText}): ${bodyText}`
    );
  }

  return (await response.json()) as T;
}

function mapTeamForDb(apiTeam: FootballDataTeam): Prisma.TeamCreateInput {
  return {
    externalId: apiTeam.id,
    name: apiTeam.name,
    shortName: apiTeam.shortName ?? apiTeam.tla ?? null,
    crestUrl: apiTeam.crest ?? null,
    venue: apiTeam.venue ?? null,
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function upsertTeams(teams: FootballDataTeam[]) {
  const operations = teams.map((team) => {
    const data = mapTeamForDb(team);
    return prisma.team.upsert({
      where: { externalId: data.externalId },
      update: {
        name: data.name,
        shortName: data.shortName,
        crestUrl: data.crestUrl,
        venue: data.venue,
      },
      create: data,
    });
  });

  for (const chunk of chunkArray(operations, 50)) {
    await prisma.$transaction(chunk);
  }
}

function mapMatchForDb(
  apiMatch: FootballDataMatch,
  teamIdByExternalId: Map<number, number>
): StoredMatch | null {
  const homeExternalId = apiMatch.homeTeam?.id;
  const awayExternalId = apiMatch.awayTeam?.id;

  if (!homeExternalId || !awayExternalId) {
    return null;
  }

  const homeTeamId = teamIdByExternalId.get(homeExternalId);
  const awayTeamId = teamIdByExternalId.get(awayExternalId);

  if (!homeTeamId || !awayTeamId) {
    return null;
  }

  return {
    externalId: apiMatch.id,
    utcDate: new Date(apiMatch.utcDate),
    status: apiMatch.status ?? "UNKNOWN",
    matchday: apiMatch.matchday ?? null,
    stage: apiMatch.stage ?? null,
    homeTeamId,
    awayTeamId,
    venue: apiMatch.venue ?? null,
    scoreHome: apiMatch.score?.fullTime?.home ?? null,
    scoreAway: apiMatch.score?.fullTime?.away ?? null,
    lastFetchedAt: new Date(),
  };
}

async function upsertMatches(matches: FootballDataMatch[]) {
  const teams = await prisma.team.findMany({
    select: { id: true, externalId: true },
  });

  const teamIdByExternalId = new Map(teams.map((team) => [team.externalId, team.id]));

  const validMatches: StoredMatch[] = [];
  let skipped = 0;

  for (const match of matches) {
    const mapped = mapMatchForDb(match, teamIdByExternalId);
    if (!mapped) {
      skipped += 1;
      continue;
    }
    validMatches.push(mapped);
  }

  for (const match of validMatches) {
    await prisma.match.upsert({
      where: { externalId: match.externalId },
      update: {
        utcDate: match.utcDate,
        status: match.status,
        matchday: match.matchday,
        stage: match.stage,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        venue: match.venue,
        scoreHome: match.scoreHome,
        scoreAway: match.scoreAway,
        lastFetchedAt: match.lastFetchedAt,
      },
      create: match,
    });
  }

  return { saved: validMatches.length, skipped };
}

function asJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function main() {
  const competitionCode = process.env.FOOTBALL_DATA_COMPETITION ?? "PL";
  const season = process.env.FOOTBALL_DATA_SEASON;

  console.log(
    `Fetching league data from football-data.org (competition=${competitionCode}${
      season ? `, season=${season}` : ""
    })...`
  );

  const [teamsPayload, standingsPayload, matchesPayload] = await Promise.all([
    fetchFromFootballData<FootballDataTeamsPayload>(
      `/competitions/${competitionCode}/teams`,
      { season }
    ),
    fetchFromFootballData<FootballDataStandingsPayload>(
      `/competitions/${competitionCode}/standings`,
      { season }
    ),
    fetchFromFootballData<FootballDataMatchesPayload>(
      `/competitions/${competitionCode}/matches`,
      { season }
    ),
  ]);

  const teams = Array.isArray(teamsPayload.teams) ? teamsPayload.teams : [];
  if (teams.length === 0) {
    throw new Error("No teams returned from football-data.org for this competition");
  }

  await upsertTeams(teams);

  const matches = Array.isArray(matchesPayload.matches) ? matchesPayload.matches : [];
  const matchResult = await upsertMatches(matches);

  const snapshotSeason = buildSeasonLabel(
    standingsPayload.season ?? teamsPayload.season
  );

  await prisma.standingsSnapshot.create({
    data: {
      season: snapshotSeason,
      data: {
        source: "football-data.org",
        competitionCode,
        competition: asJsonValue(standingsPayload.competition ?? teamsPayload.competition ?? null),
        season: asJsonValue(standingsPayload.season ?? teamsPayload.season ?? null),
        standings: asJsonValue(standingsPayload.standings ?? []),
      },
    },
  });

  console.log(
    `Saved ${teams.length} teams, ${matchResult.saved} matches (skipped ${matchResult.skipped}), and one standings snapshot (${snapshotSeason}).`
  );
}

main()
  .catch((error: unknown) => {
    console.error("Failed to initialize league data:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
