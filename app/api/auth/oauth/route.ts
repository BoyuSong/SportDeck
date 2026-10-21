import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@/prisma/generated/index.js";
import { prisma } from "@/prisma/client";
import { issueTokens } from "@/utils/auth";
import { slugifyUsernameSeed, verifyOAuthIdentity } from "@/utils/oauth";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function findAvailableUsername(tx: Prisma.TransactionClient, seed: string) {
  const base = slugifyUsernameSeed(seed);

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}_${suffix}`;
    const existing = await tx.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Could not allocate a unique username");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return jsonError("Invalid JSON", 400);
    }

    const provider = typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "";
    const code = typeof body.code === "string" ? body.code.trim() : undefined;
    const idToken = typeof body.idToken === "string" ? body.idToken.trim() : undefined;

    let identity;
    try {
      identity = await verifyOAuthIdentity({ provider, code, idToken });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "OAuth verification failed", 401);
    }

    if (!identity.emailVerified) {
      return jsonError("Third-party account email is not verified", 403);
    }

    const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existingAccount = await tx.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: identity.provider,
            providerAccountId: identity.providerAccountId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              role: true,
            },
          },
        },
      });

      if (existingAccount) {
        return existingAccount.user;
      }

      const existingUser = await tx.user.findUnique({
        where: { email: identity.email },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
        },
      });

      if (existingUser) {
        await tx.oAuthAccount.create({
          data: {
            userId: existingUser.id,
            provider: identity.provider,
            providerAccountId: identity.providerAccountId,
            email: identity.email,
          },
        });

        return existingUser;
      }

      const username = await findAvailableUsername(tx, identity.name || identity.email);

      const createdUser = await tx.user.create({
        data: {
          email: identity.email,
          username,
          avatarUrl: identity.avatarUrl,
          oauthAccounts: {
            create: {
              provider: identity.provider,
              providerAccountId: identity.providerAccountId,
              email: identity.email,
            },
          },
        },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
        },
      });

      return createdUser;
    });

    const { accessToken, refreshToken, accessExpiresAtMs, refreshExpiresAtMs } = issueTokens(user);

    return NextResponse.json(
      {
        accessToken,
        refreshToken,
        accessTokenExpiresAt: new Date(accessExpiresAtMs).toISOString(),
        refreshTokenExpiresAt: new Date(refreshExpiresAtMs).toISOString(),
        user,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}
