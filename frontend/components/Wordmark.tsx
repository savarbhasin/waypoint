export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 text-paper ${compact ? "" : ""}`}>
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber shrink-0" aria-hidden="true">
        <path d="M12 2 L21 12 L12 22 L3 12 Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
      <span className={`font-display tracking-wide ${compact ? "text-[1.0625rem]" : "text-[1.375rem]"}`}>
        Waypoint
      </span>
    </div>
  );
}
