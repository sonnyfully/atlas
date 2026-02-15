"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Recent", sort: "recent" },
  { label: "A\u2013Z", sort: "alpha" },
] as const;

export function LibraryTabs({ activeSort }: { activeSort: string }) {
  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.sort}
          href={`/tracks?sort=${tab.sort}`}
          className={cn(
            "px-4 py-2 text-body-sm font-medium transition-colors -mb-px border-b-2",
            activeSort === tab.sort
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
