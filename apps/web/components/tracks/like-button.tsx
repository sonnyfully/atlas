"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LikeButtonProps {
  className?: string;
  size?: "sm" | "default";
  ariaLabel?: string;
}

export function LikeButton({
  className,
  size = "default",
  ariaLabel = "track",
}: LikeButtonProps) {
  const [liked, setLiked] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              size === "sm" ? "h-11 w-11" : "h-11 w-11",
              "text-muted-foreground",
              liked && "text-primary",
              className,
            )}
            aria-label={liked ? `Unlike ${ariaLabel}` : `Like ${ariaLabel}`}
            onClick={() => setLiked(!liked)}
          >
            <Heart
              className={cn(
                size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
                liked && "fill-current",
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{liked ? "Unlike" : "Like"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
