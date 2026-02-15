import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TrackNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
      <h1 className="text-h1 text-foreground">Track not found</h1>
      <p className="mt-2 text-body text-muted-foreground">
        This track doesn&apos;t exist in the atlas yet.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Back to Discover</Link>
      </Button>
    </div>
  );
}
