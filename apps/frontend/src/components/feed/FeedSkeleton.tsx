import { Skeleton } from "@/components/ui/Skeleton";

/** Matches {@link FeedItem} layout: one viewport-tall snap card (`h-full` of the feed scroll area). */
export function FeedSkeleton() {
  return (
    <>
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="relative h-full shrink-0 snap-start overflow-hidden touch-pan-y"
        >
          <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 space-y-2 p-4 sm:bottom-1 sm:p-5">
            <Skeleton className="h-3 w-24 rounded-none" />
            <Skeleton className="h-7 w-48 max-w-[85%] rounded-none" />
            <Skeleton className="h-3 w-32 rounded-none" />
          </div>
        </div>
      ))}
    </>
  );
}
