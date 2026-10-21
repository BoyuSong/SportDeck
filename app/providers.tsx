"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "dark" | "light";

type ThemeContextValue = {
  setTheme: (theme: Theme) => void;
  theme: Theme;
  toggleTheme: () => void;
};

type AuthUser = {
  avatarUrl: string | null;
  createdAt?: string;
  email: string;
  favoriteTeamId: number | null;
  id: number;
  role: "ADMIN" | "USER";
  updatedAt?: string;
  username: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  email: string;
  password: string;
  username: string;
};

type OAuthPayload =
  | {
      idToken: string;
      provider: "google";
    }
  | {
      code: string;
      provider: "github";
    };

type AuthContextValue = {
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  loginWithOAuth: (payload: OAuthPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<AuthUser | null>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  user: AuthUser | null;
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

const ACCESS_TOKEN_KEY = "sportsdeck_access_token";
const REFRESH_TOKEN_KEY = "sportsdeck_refresh_token";

const ThemeContext = createContext<ThemeContextValue | null>(null);
const AuthContext = createContext<AuthContextValue | null>(null);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

function getInitialTheme(): Theme {
  if (typeof document !== "undefined") {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }

  return "light";
}

function getStoredTokens() {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null };
  }

  return {
    accessToken: window.localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: window.localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

function persistTokens(accessToken: string, refreshToken: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearStoredTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | (Record<string, unknown> & T)
    | null;

  if (!response.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) ||
      "Request failed";
    throw new Error(message);
  }

  return (data ?? {}) as T;
}

export function Providers({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function setTheme(nextTheme: Theme) {
    setThemeState(nextTheme);
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  async function refreshTokens(currentRefreshToken: string) {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: currentRefreshToken }),
    });

    const data = await parseJson<{
      accessToken: string;
      refreshToken: string;
    }>(response);

    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    persistTokens(data.accessToken, data.refreshToken);

    return data.accessToken;
  }

  async function refreshProfileWithToken(token: string) {
    const response = await fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await parseJson<{ user: AuthUser }>(response);
    setUser(data.user);
    return data.user;
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      const stored = getStoredTokens();
      if (!stored.accessToken || !stored.refreshToken) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      setAccessToken(stored.accessToken);
      setRefreshToken(stored.refreshToken);

      try {
        await refreshProfileWithToken(stored.accessToken);
      } catch {
        try {
          const nextAccessToken = await refreshTokens(stored.refreshToken);
          await refreshProfileWithToken(nextAccessToken);
        } catch {
          clearStoredTokens();
          if (!cancelled) {
            setAccessToken(null);
            setRefreshToken(null);
            setUser(null);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  async function consumeAuthResponse(promise: Promise<Response>) {
    const data = await parseJson<AuthResponse>(await promise);
    persistTokens(data.accessToken, data.refreshToken);
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
    return data.user;
  }

  async function login(payload: LoginPayload) {
    return consumeAuthResponse(
      fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    );
  }

  async function register(payload: RegisterPayload) {
    return consumeAuthResponse(
      fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    );
  }

  async function loginWithOAuth(payload: OAuthPayload) {
    return consumeAuthResponse(
      fetch("/api/auth/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    );
  }

  async function logout() {
    const currentAccessToken = accessToken;
    const currentRefreshToken = refreshToken;

    try {
      if (currentAccessToken) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentAccessToken}`,
          },
          body: JSON.stringify({
            refreshToken: currentRefreshToken,
          }),
        });
      }
    } finally {
      clearStoredTokens();
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
    }
  }

  async function refreshProfile() {
    if (!accessToken) {
      setUser(null);
      return null;
    }

    try {
      return await refreshProfileWithToken(accessToken);
    } catch {
      if (!refreshToken) {
        setUser(null);
        setAccessToken(null);
        return null;
      }

      const nextAccessToken = await refreshTokens(refreshToken);
      return refreshProfileWithToken(nextAccessToken);
    }
  }

  const themeValue = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme]
  );

  const authValue = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      isAuthenticated: Boolean(user && accessToken),
      isLoading,
      login,
      loginWithOAuth,
      logout,
      refreshProfile,
      register,
      user,
    }),
    [accessToken, isLoading, refreshToken, user]
  );

  return (
    <ThemeContext.Provider value={themeValue}>
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("useTheme must be used inside Providers");
  }

  return value;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside Providers");
  }

  return value;
}
