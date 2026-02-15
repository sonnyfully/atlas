"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Library, Heart, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Upload", href: "/upload", icon: Upload },
  { label: "Explore", href: "/map", icon: Compass },
  { label: "Library", href: "/tracks", icon: Library },
  { label: "Likes", href: "#", icon: Heart, disabled: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-background pb-16">
      {/* Brand */}
      <div className="flex h-14 items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2">
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
          Discover
        </span>
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href) && item.href !== "#";

          return (
            <Link
              key={item.label}
              href={item.disabled ? "#" : item.href}
              aria-disabled={item.disabled}
              className={cn(
                "flex h-9 items-center gap-3 rounded-md px-3 text-body-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                item.disabled && "pointer-events-none opacity-40",
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
          className="flex items-center gap-2 px-3 text-body-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload tracks
        </Link>
      </div>
    </aside>
  );
}
