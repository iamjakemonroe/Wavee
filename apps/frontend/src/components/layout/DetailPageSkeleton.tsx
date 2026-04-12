/**
 * Loading chrome for playlist / user detail heroes: full-bleed (no top gap, no rounded hero),
 * matching the real layout’s gradient stack and control positions.
 */
export function DetailPageHeroSkeleton() {
  return (
    <div className="relative -mx-4 -mt-4 mb-5 min-h-[200px] overflow-hidden sm:-mx-6 sm:-mt-6 sm:min-h-[220px]">
      <div
        className="pointer-events-none absolute inset-0 min-h-[200px] bg-wavee-bg bg-wavee-gradient sm:min-h-[220px]"
        aria-hidden
      />
      <div
        className="absolute inset-0 min-h-[200px] animate-pulse bg-white/[0.045] sm:min-h-[220px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 min-h-[200px] bg-gradient-to-b from-black/50 via-black/22 via-[45%] to-black/40 sm:min-h-[220px]"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-[200px] flex-col px-4 pb-5 pt-2 sm:min-h-[220px] sm:px-6 sm:pb-6 sm:pt-3">
        <div className="mb-4 flex items-start gap-3 sm:mb-5">
          <div className="min-w-0 flex-1 space-y-3 pt-0.5">
            <div
              className="h-[1.75rem] max-w-[min(92%,20rem)] animate-pulse rounded-md bg-white/[0.14] sm:h-9 sm:max-w-[18rem]"
              aria-hidden
            />
            <div
              className="h-3.5 w-28 animate-pulse rounded-md bg-white/[0.09] sm:h-4 sm:w-32"
              aria-hidden
            />
            <div
              className="hidden h-3 max-w-lg animate-pulse rounded-md bg-white/[0.07] sm:block"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DetailPageTrackListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
        >
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-white/[0.08]" aria-hidden />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-[min(100%,14rem)] animate-pulse rounded-md bg-white/[0.08]" aria-hidden />
            <div className="h-3 w-24 animate-pulse rounded-md bg-white/[0.06]" aria-hidden />
          </div>
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/[0.06]" aria-hidden />
        </div>
      ))}
    </div>
  );
}
