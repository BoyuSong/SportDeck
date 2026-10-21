import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/prisma/client";
import type { User, UserRole } from "@/prisma/generated/index.js";

type JwtPayload = {
  expiresAt?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
};

export type AuthTokenPayload = JwtPayload & {
  userId: number;
  email: string;
  username: string;
  role: UserRole;
};

type WithAuthOptions = {
  checkBan?: boolean;
  requireRole?: UserRole;
};

type AuthenticatedHandler<Args extends unknown[]> = (
  request: NextRequest,
  payload: AuthTokenPayload,
  ...args: Args
) => Promise<Response>;

function isAuthTokenPayload(value: string | JwtPayload): value is AuthTokenPayload {
  if (!value || typeof value === "string") {
    return false;
  }

  return (
    typeof value.userId === "number" &&
    typeof value.email === "string" &&
    typeof value.username === "string" &&
    typeof value.role === "string"
  );
}

export function getBearerTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function getTokenExpiryDate(payload: JwtPayload): Date | null {
  if (typeof payload.exp === "number") {
    return new Date(payload.exp * 1000);
  }

  if (typeof payload.expiresAt === "string") {
    const expiresAtMs = Date.parse(payload.expiresAt);
    if (Number.isFinite(expiresAtMs)) {
      return new Date(expiresAtMs);
    }
  }

  return null;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function isTokenRevoked(token: string) {
  const tokenHash = hashToken(token);
  const revokedToken = await prisma.revokedToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      expiresAt: true,
    },
  });

  if (!revokedToken) {
    return false;
  }

  if (revokedToken.expiresAt <= new Date()) {
    await prisma.revokedToken.delete({ where: { tokenHash } }).catch(() => undefined);
    return false;
  }

  return true;
}

async function verifyAccessTokenFromRequest(request: NextRequest): Promise<AuthTokenPayload | null> {
  const token = getBearerTokenFromRequest(request);
  if (!token) return null;

  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not configured");

  try {
    if (await isTokenRevoked(token)) {
      return null;
    }

    const payload = jwt.verify(token, secret);

    if (!isAuthTokenPayload(payload)) {
      return null;
    }

    if (payload.expiresAt) {
      const expiresAtMs = Date.parse(payload.expiresAt);
      if (Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs) {
        return null;
      }
    }

    return payload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(refreshToken: string) {
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshSecret) {
    throw new Error("JWT_REFRESH_SECRET is not configured");
  }

  if (await isTokenRevoked(refreshToken)) {
    return null;
  }

  const payload = jwt.verify(refreshToken, refreshSecret);
  if (!isAuthTokenPayload(payload)) {
    return null;
  }

  return payload;
}

export async function revokeToken(
  token: string,
  tokenType: "ACCESS" | "REFRESH",
  expiresAt: Date
) {
  if (expiresAt <= new Date()) {
    return;
  }

  await prisma.revokedToken.upsert({
    where: {
      tokenHash: hashToken(token),
    },
    update: {
      expiresAt,
      tokenType,
    },
    create: {
      tokenHash: hashToken(token),
      tokenType,
      expiresAt,
    },
  });
}

export function withAuth<Args extends unknown[]>(
  handler: AuthenticatedHandler<Args>,
  options: WithAuthOptions = {}
) {
  return async function authedHandler(
    request: NextRequest,
    ...args: Args
  ): Promise<Response> {
    const payload = await verifyAccessTokenFromRequest(request);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (options.requireRole && payload.role !== options.requireRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (options.checkBan) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          banStatus: true,
        },
      });

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (user.banStatus === "BANNED") {
        return NextResponse.json(
          { error: "Banned users cannot perform this action" },
          { status: 403 }
        );
      }
    }

    return handler(request, payload, ...args);
  };
}

type TokenUser = Pick<User, "email" | "id" | "role" | "username">;

export function issueTokens(user: TokenUser) {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw new Error("JWT secrets are not configured on the server");
  }

  const accessMinutes = Number(process.env.JWT_ACCESS_EXPIRES_MINUTES ?? "15");
  const refreshDays = Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? "7");

  if (!Number.isFinite(accessMinutes) || accessMinutes <= 0) {
    throw new Error("JWT_ACCESS_EXPIRES_MINUTES must be a positive number");
  }
  if (!Number.isFinite(refreshDays) || refreshDays <= 0) {
    throw new Error("JWT_REFRESH_EXPIRES_DAYS must be a positive number");
  }

  const nowMs = Date.now();
  const accessExpiresAtMs = nowMs + accessMinutes * 60 * 1000;
  const refreshExpiresAtMs = nowMs + refreshDays * 24 * 60 * 60 * 1000;

  const payload: AuthTokenPayload = {
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, accessSecret, {
    expiresIn: `${accessMinutes}m`,
  });

  const refreshToken = jwt.sign(payload, refreshSecret, {
    expiresIn: `${refreshDays}d`,
  });

  return {
    accessExpiresAtMs,
    accessToken,
    refreshExpiresAtMs,
    refreshToken,
  };
}
