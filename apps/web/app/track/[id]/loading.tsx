import { Skeleton } from "@/components/ui/skeleton";

export default function TrackLoading() {
  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">
      {/* Hero skeleton */}
      <div className="flex gap-6">
        <Skeleton className="h-48 w-48 rounded-md" />
        <div className="flex-1 space-y-3 py-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
      <Skeleton className="mt-6 h-16 w-full rounded-sm" />
    </div>
  );
}
