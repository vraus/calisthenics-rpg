import type { Metadata, Viewport } from "next";
import { Cinzel } from "next/font/google";
import "./globals.css";
import RegisterServiceWorker from "./register-sw";
import NavBar from "./nav-bar";
import { getCurrentZone } from "@/lib/theme";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display-family",
});

export const metadata: Metadata = {
  title: "Calisthenics RPG",
  description: "Suivi gamifié de progression en calisthénie",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Calisthenics RPG",
  },
};

export const viewport: Viewport = {
  themeColor: "#17120c",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const zone = await getCurrentZone();

  return (
    <html
      lang="fr"
      className={`h-full antialiased ${cinzel.variable}`}
      data-zone={zone ?? undefined}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <RegisterServiceWorker />
        <NavBar />
        <div className="flex flex-1 flex-col pt-14">{children}</div>
      </body>
    </html>
  );
}
