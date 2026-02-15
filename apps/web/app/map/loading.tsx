import { Skeleton } from "@/components/ui/skeleton";

export default function MapLoading() {
  return (
    <div className="px-6 lg:px-8 py-8 max-w-5xl space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="flex gap-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-10 w-44" />
      </div>
      <Skeleton className="w-full aspect-[16/10] rounded-lg" />
    </div>
  );
}
