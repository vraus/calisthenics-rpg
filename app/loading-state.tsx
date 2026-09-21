/**
 * Shared loading UI for route segments (imported by each segment's
 * loading.tsx — Next.js requires the file itself to live per-segment, but
 * the markup can be shared). Shows instantly while a page's Server
 * Component data is still fetching, instead of leaving the previous page
 * frozen on screen.
 */
export default function LoadingState() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-gold animate-spin" />
        <p className="text-sm text-muted">Chargement...</p>
      </div>
    </main>
  );
}
