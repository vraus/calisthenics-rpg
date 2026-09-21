"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "./logout/actions";

const LINKS = [
  { href: "/dashboard", label: "Niveau" },
  { href: "/plan", label: "Plan" },
  { href: "/log", label: "Séance" },
  { href: "/tree", label: "Arbres" },
  { href: "/history", label: "Historique" },
  { href: "/stats", label: "Stats" },
] as const;

const HIDDEN_ON = ["/login", "/auth"];

/**
 * Fixed top header with a hamburger menu — a full-screen panel is simpler
 * to get right on mobile (no accidental clicks) than a slide-in drawer, and
 * this app has no desktop-only layout to preserve horizontal space for.
 */
export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-20 h-14 border-b border-border bg-surface/95 backdrop-blur flex items-center justify-between px-4">
        <span className="font-display text-lg font-bold tracking-wide text-accent-strong">
          Calisthenics RPG
        </span>
        <button
          type="button"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-surface-alt transition-colors"
        >
          <span
            className={`block h-0.5 w-5 bg-foreground transition-transform ${
              open ? "translate-y-2 rotate-45" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-5 bg-foreground transition-opacity ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-5 bg-foreground transition-transform ${
              open ? "-translate-y-2 -rotate-45" : ""
            }`}
          />
        </button>
      </header>

      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-10 pt-14 bg-background/98 backdrop-blur-sm flex flex-col transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
          className="absolute inset-0 -z-10"
        />
        <nav className="flex flex-1 flex-col items-center justify-center gap-2 px-6">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`font-display w-full max-w-xs text-center rounded-lg border px-6 py-4 text-lg transition-colors ${
                  active
                    ? "border-gold text-gold panel-rpg-gold panel-rpg"
                    : "border-border text-foreground panel-rpg hover:border-accent"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <form action={logout} className="w-full max-w-xs mt-4">
            <button
              type="submit"
              className="w-full rounded-lg border border-border px-6 py-3 text-sm text-muted hover:text-accent-strong hover:border-accent transition-colors"
            >
              Déconnexion
            </button>
          </form>
        </nav>
      </div>
    </>
  );
}
