import type { Metadata, Viewport } from "next";
import { Cinzel } from "next/font/google";
import "./globals.css";
import RegisterServiceWorker from "./register-sw";
import NavBar from "./nav-bar";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`h-full antialiased ${cinzel.variable}`}>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <RegisterServiceWorker />
        <NavBar />
        <div className="flex flex-1 flex-col pt-14">{children}</div>
      </body>
    </html>
  );
}
