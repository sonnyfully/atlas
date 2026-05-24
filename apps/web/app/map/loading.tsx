import { Skeleton } from "@/components/ui/skeleton";

export default function MapLoading() {
  return (
    <div className="min-h-full space-y-5 px-4 py-4 md:px-6 md:py-6 lg:px-8">
      <Skeleton className="h-52 w-full rounded-[32px]" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Skeleton className="h-[min(78vh,920px)] min-h-[560px] w-full rounded-[32px]" />
        <Skeleton className="h-[520px] w-full rounded-[32px]" />
      </div>
    </div>
  );
}
