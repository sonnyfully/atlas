import { Skeleton } from "@/components/ui/skeleton";

export default function TracksLoading() {
  return (
    <div className="px-6 lg:px-8 py-8">
      <Skeleton className="h-8 w-32 mb-6" />
      <div className="flex gap-1 border-b border-border mb-6">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-16" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-sm" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="hidden lg:block h-8 w-[200px] rounded-sm" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}
