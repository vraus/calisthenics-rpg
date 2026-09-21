"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker on mount. Rendered once from the root
 * layout. Silently no-ops when service workers aren't supported.
 */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed", err);
    });
  }, []);

  return null;
}
