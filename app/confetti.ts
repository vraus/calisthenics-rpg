import confetti from "canvas-confetti";

/**
 * Confetti presets, escalating with what was just accomplished. Colors
 * match the app's "cuir & bronze" palette (app/globals.css) instead of
 * canvas-confetti's rainbow default, so it reads as a reward, not noise.
 */
const PALETTE = ["#d4af37", "#c9853f", "#8b5a2b"];

/** A single set/exercise validated. */
export function fireConfettiBurst() {
  confetti({
    particleCount: 30,
    spread: 55,
    origin: { y: 0.7 },
    colors: PALETTE,
    scalar: 0.8,
  });
}

/** A day finished (partially, or a free-form log). */
export function fireConfettiCelebration() {
  confetti({
    particleCount: 80,
    spread: 80,
    origin: { y: 0.6 },
    colors: PALETTE,
  });
}

/** A day finished at 100%, or a perfect week. */
export function fireConfettiGrand() {
  const end = Date.now() + 1200;

  (function frame() {
    confetti({
      particleCount: 6,
      angle: 60,
      spread: 60,
      origin: { x: 0 },
      colors: PALETTE,
    });
    confetti({
      particleCount: 6,
      angle: 120,
      spread: 60,
      origin: { x: 1 },
      colors: PALETTE,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  confetti({
    particleCount: 120,
    spread: 100,
    origin: { y: 0.5 },
    colors: PALETTE,
  });
}
