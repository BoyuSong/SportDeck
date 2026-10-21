import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/app/providers";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "SportsDeck",
  description: "SportsDeck league hub for fixtures, standings, match threads, community, and moderation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeInitScript = `
    (() => {
      try {
        const storedTheme = window.localStorage.getItem("theme");
        const theme =
          storedTheme === "light" || storedTheme === "dark"
            ? storedTheme
            : window.matchMedia("(prefers-color-scheme: dark)").matches
              ? "dark"
              : "light";
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(theme);
      } catch {}
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers>
          <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
            <Navbar />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
