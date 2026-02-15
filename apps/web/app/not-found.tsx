import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
      <h1 className="text-h1 text-foreground">404</h1>
      <p className="mt-2 text-body text-muted-foreground">
        This page doesn&apos;t exist in the atlas.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Go Home</Link>
      </Button>
    </div>
  );
}
