"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "./logout/actions";

const LINKS = [
  { href: "/dashboard", label: "Niveau" },
  { href: "/log", label: "Séance" },
  { href: "/tree", label: "Arbres" },
  { href: "/history", label: "Historique" },
  { href: "/stats", label: "Stats" },
] as const;

const HIDDEN_ON = ["/login", "/auth"];

/**
 * Fixed bottom navigation, thumb-reachable on mobile. Rendered from the
 * root layout so it's present on every screen except login.
 */
export default function NavBar() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-10 border-t border-border bg-surface/95 backdrop-blur">
      <ul className="flex justify-around">
        {LINKS.map((link) => (
          <li key={link.href} className="flex-1">
            <Link
              href={link.href}
              className="flex flex-col items-center gap-1 py-3 text-xs font-medium text-muted hover:text-accent-strong transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
        <li className="flex-1">
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full flex-col items-center gap-1 py-3 text-xs font-medium text-muted hover:text-accent-strong transition-colors"
            >
              Déconnexion
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
