"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers";

type OAuthButtonsProps = {
  mode: "login" | "register";
  onError: (message: string | null) => void;
};

type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            auto_select?: boolean;
            callback: (response: GoogleCredentialResponse) => void;
            client_id: string;
            ux_mode?: "popup" | "redirect";
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>
          ) => void;
        };
      };
    };
  }
}

const GOOGLE_SCRIPT_ID = "google-identity-services";
const GITHUB_STATE_KEY = "sportsdeck_github_oauth_state";

function randomState() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function OAuthButtons({ mode, onError }: OAuthButtonsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { loginWithOAuth } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState<"github" | "google" | null>(null);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  const githubClientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ?? "";

  useEffect(() => {
    if (!googleClientId) {
      return;
    }

    let cancelled = false;

    function initializeGoogle() {
      if (cancelled || !window.google || !googleButtonRef.current) {
        return;
      }

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        ux_mode: "popup",
        callback: async (response) => {
          if (!response.credential) {
            onError("Google sign-in did not return a credential.");
            return;
          }

          setOauthSubmitting("google");
          onError(null);

          try {
            await loginWithOAuth({
              provider: "google",
              idToken: response.credential,
            });
            router.replace("/forums");
            router.refresh();
          } catch (error) {
            onError(error instanceof Error ? error.message : "Unable to sign in with Google");
          } finally {
            setOauthSubmitting(null);
          }
        },
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: mode === "register" ? "signup_with" : "signin_with",
        logo_alignment: "left",
        width: 360,
      });

      setGoogleReady(true);
    }

    if (window.google) {
      initializeGoogle();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", initializeGoogle, { once: true });
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", initializeGoogle, { once: true });
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [googleClientId, loginWithOAuth, mode, onError, router]);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      onError(error === "access_denied" ? "GitHub sign-in was canceled." : "GitHub sign-in failed.");
      router.replace(pathname);
      return;
    }

    if (!code) {
      return;
    }

    const githubCode = code;

    const expectedState = window.sessionStorage.getItem(GITHUB_STATE_KEY);
    if (!state || !expectedState || state !== expectedState) {
      onError("GitHub sign-in could not be verified. Please try again.");
      router.replace(pathname);
      return;
    }

    window.sessionStorage.removeItem(GITHUB_STATE_KEY);

    let cancelled = false;

    async function exchangeGithubCode() {
      setOauthSubmitting("github");
      onError(null);

      try {
        await loginWithOAuth({
          provider: "github",
          code: githubCode,
        });

        if (!cancelled) {
          router.replace("/forums");
          router.refresh();
        }
      } catch (exchangeError) {
        if (!cancelled) {
          onError(
            exchangeError instanceof Error
              ? exchangeError.message
              : "Unable to sign in with GitHub"
          );
          router.replace(pathname);
        }
      } finally {
        if (!cancelled) {
          setOauthSubmitting(null);
        }
      }
    }

    void exchangeGithubCode();

    return () => {
      cancelled = true;
    };
  }, [loginWithOAuth, onError, pathname, router, searchParams]);

  function handleGithubSignIn() {
    if (!githubClientId) {
      onError("GitHub sign-in is not configured.");
      return;
    }

    const redirectUri = `${window.location.origin}${pathname}`;
    const state = randomState();
    window.sessionStorage.setItem(GITHUB_STATE_KEY, state);

    const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
    authorizeUrl.searchParams.set("client_id", githubClientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", "read:user user:email");
    authorizeUrl.searchParams.set("state", state);

    window.location.href = authorizeUrl.toString();
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[color:var(--border)]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[color:var(--surface)] px-4 text-xs font-semibold uppercase tracking-[0.22em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
            Or continue with
          </span>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="min-h-11">
          {googleClientId ? (
            <div
              ref={googleButtonRef}
              className={googleReady ? "" : "flex h-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]"}
            >
              {oauthSubmitting === "google" ? "Signing in with Google..." : "Loading Google sign-in..."}
            </div>
          ) : (
            <div className="flex h-11 items-center justify-center rounded-full border border-dashed border-[color:var(--border)] bg-[color:var(--surface-muted)] text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
              Google sign-in is not configured
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleGithubSignIn}
          disabled={oauthSubmitting !== null}
          className="flex h-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 text-sm font-semibold transition hover:bg-[color:var(--surface)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {oauthSubmitting === "github"
            ? "Signing in with GitHub..."
            : mode === "register"
              ? "Continue with GitHub"
              : "Sign in with GitHub"}
        </button>
      </div>
    </div>
  );
}
