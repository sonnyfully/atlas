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
  liked?: boolean;
  onLikedChange?: (liked: boolean) => void;
}

export function LikeButton({
  className,
  size = "default",
  ariaLabel = "track",
  liked,
  onLikedChange,
}: LikeButtonProps) {
  const [internalLiked, setInternalLiked] = useState(false);
  const isLiked = liked ?? internalLiked;

  const handleToggle = () => {
    const next = !isLiked;
    if (liked === undefined) {
      setInternalLiked(next);
    }
    onLikedChange?.(next);
  };

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
              isLiked && "text-primary",
              className,
            )}
            aria-label={isLiked ? `Unlike ${ariaLabel}` : `Like ${ariaLabel}`}
            onClick={handleToggle}
          >
            <Heart
              className={cn(
                size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
                isLiked && "fill-current",
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isLiked ? "Unlike" : "Like"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
