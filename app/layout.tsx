import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterServiceWorker from "./register-sw";
import NavBar from "./nav-bar";

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
  themeColor: "#5b21b6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <RegisterServiceWorker />
        <div className="flex flex-1 flex-col pb-16">{children}</div>
        <NavBar />
      </body>
    </html>
  );
}
