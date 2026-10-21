"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/theme-toggle";
import { useAuth } from "@/app/providers";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/matches", label: "Matches" },
  { href: "/standings", label: "Standings" },
  { href: "/forums", label: "Forums" },
];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        isActive
          ? "bg-[color:var(--surface-strong)] text-[color:var(--surface-strong-foreground)]"
          : "text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
      }`}
    >
      {label}
    </Link>
  );
}

export function Navbar() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--surface)]/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Link href="/" className="text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
            SportsDeck
          </Link>
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ThemeToggle />

          {isLoading ? (
            <span className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_60%,transparent)]">
              Loading account...
            </span>
          ) : isAuthenticated && user ? (
            <>
              <Link
                href="/profile"
                className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
              >
                Dashboard
              </Link>
              <Link
                href="/digest"
                className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
              >
                Digest
              </Link>
              <Link
                href={`/users/${user.id}`}
                className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
              >
                {user.username}
              </Link>
              {user.role === "ADMIN" ? (
                <Link
                  href="/admin"
                  className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                >
                  Admin
                </Link>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
