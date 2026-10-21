type OAuthProvider = "google" | "github";

export type OAuthIdentity = {
  avatarUrl: string | null;
  email: string;
  emailVerified: boolean;
  name: string;
  provider: OAuthProvider;
  providerAccountId: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function parseJsonResponse(response: Response) {
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const message =
      (data && typeof data.error_description === "string" && data.error_description) ||
      (data && typeof data.message === "string" && data.message) ||
      `OAuth provider request failed with status ${response.status}`;
    throw new Error(message);
  }
  return data ?? {};
}

async function verifyGoogleIdToken(idToken: string): Promise<OAuthIdentity> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const data = await parseJsonResponse(response);
  const audience = typeof data.aud === "string" ? data.aud : "";
  const configuredAudience = process.env.GOOGLE_CLIENT_ID;

  if (configuredAudience && audience !== configuredAudience) {
    throw new Error("Google token audience does not match GOOGLE_CLIENT_ID");
  }

  const providerAccountId = typeof data.sub === "string" ? data.sub : "";
  const email = typeof data.email === "string" ? normalizeEmail(data.email) : "";
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : email;
  const avatarUrl = typeof data.picture === "string" ? data.picture : null;
  const emailVerified = data.email_verified === "true" || data.email_verified === true;

  if (!providerAccountId || !email) {
    throw new Error("Google did not return a valid user identity");
  }

  return {
    provider: "google",
    providerAccountId,
    email,
    name,
    avatarUrl,
    emailVerified,
  };
}

async function fetchGithubAccessToken(code: string) {
  const clientId = getRequiredEnv("GITHUB_CLIENT_ID");
  const clientSecret = getRequiredEnv("GITHUB_CLIENT_SECRET");

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const data = await parseJsonResponse(response);
  const accessToken = typeof data.access_token === "string" ? data.access_token : "";
  if (!accessToken) {
    throw new Error("GitHub did not return an access token");
  }

  return accessToken;
}

async function verifyGithubCode(code: string): Promise<OAuthIdentity> {
  const accessToken = await fetchGithubAccessToken(code);

  const [userResponse, emailsResponse] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    }),
    fetch("https://api.github.com/user/emails", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    }),
  ]);

  const user = await parseJsonResponse(userResponse);
  const emails = (await emailsResponse.json().catch(() => [])) as Array<Record<string, unknown>>;

  if (!emailsResponse.ok) {
    throw new Error("GitHub did not return user emails");
  }

  const primaryEmail = emails.find(
    (entry) => entry.primary === true && typeof entry.email === "string"
  ) ?? emails.find((entry) => typeof entry.email === "string");

  const providerAccountId =
    typeof user.id === "number" || typeof user.id === "string" ? String(user.id) : "";
  const email =
    primaryEmail && typeof primaryEmail.email === "string"
      ? normalizeEmail(primaryEmail.email)
      : "";
  const name =
    (typeof user.name === "string" && user.name.trim()) ||
    (typeof user.login === "string" && user.login.trim()) ||
    email;
  const avatarUrl = typeof user.avatar_url === "string" ? user.avatar_url : null;
  const emailVerified = primaryEmail?.verified === true;

  if (!providerAccountId || !email) {
    throw new Error("GitHub did not return a valid user identity");
  }

  return {
    provider: "github",
    providerAccountId,
    email,
    name,
    avatarUrl,
    emailVerified,
  };
}

export async function verifyOAuthIdentity(input: {
  code?: string;
  idToken?: string;
  provider: string;
}) {
  if (input.provider === "google") {
    if (!input.idToken) {
      throw new Error("idToken is required for Google sign-in");
    }
    return verifyGoogleIdToken(input.idToken);
  }

  if (input.provider === "github") {
    if (!input.code) {
      throw new Error("code is required for GitHub sign-in");
    }
    return verifyGithubCode(input.code);
  }

  throw new Error("provider must be one of: google, github");
}

export function slugifyUsernameSeed(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "user";
}
