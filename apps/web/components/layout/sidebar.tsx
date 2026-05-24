"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Library, LayoutGrid, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Upload", href: "/upload", icon: Upload },
  { label: "Map", href: "/map", icon: Compass },
  { label: "Scenes", href: "/scenes", icon: LayoutGrid },
  { label: "Library", href: "/tracks", icon: Library },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border/80 bg-surface-1 pb-16 shadow-surface md:flex">
      {/* Brand */}
      <div className="flex h-14 items-center justify-between px-5">
        <Link href="/" prefetch={false} className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary" />
          <span className="text-h4 font-bold tracking-tight text-foreground">
            Atlas
          </span>
        </Link>
        <ThemeToggle />
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-3 pt-4">
        <span className="mb-2 px-3 text-caption font-semibold uppercase tracking-wider text-muted-foreground">
          Explore
        </span>
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href) && item.href !== "#";

          return (
            <Link
              key={item.label}
              href={item.href}
              prefetch={false}
              className={cn(
                "flex h-9 items-center gap-3 rounded-md px-3 text-body-sm font-medium transition-interactive duration-fast ease-out motion-reduce:transition-none",
                "focus-ring",
                isActive
                  ? "scene-selected text-foreground"
                  : "text-muted-foreground hover:bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.1)] hover:text-foreground",
              )}
            >
              <item.icon
                className={cn("h-4 w-4", isActive && "text-primary")}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto px-3 pb-4">
        <Separator className="mb-4" />
        <span className="mb-2 block px-3 text-caption font-semibold uppercase tracking-wider text-muted-foreground">
          Your Tracks
        </span>
        <Link
          href="/upload"
          prefetch={false}
          className="flex items-center gap-2 px-3 text-body-sm text-muted-foreground transition-interactive duration-fast ease-out hover:text-foreground"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload tracks
        </Link>
      </div>
    </aside>
  );
}
