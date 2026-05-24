import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { TRANSITION_INTERACTIVE } from "@/lib/motion"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  cn(
    "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold",
    "focus-ring",
    TRANSITION_INTERACTIVE
  ),
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/85",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/85",
        outline: "border-border text-foreground",
        scene:
          "border-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.35)] bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.12)] text-foreground hover:bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.18)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
