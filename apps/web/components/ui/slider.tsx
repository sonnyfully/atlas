"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { TRANSITION_INTERACTIVE } from "@/lib/motion"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    data-slot="slider-root"
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track
      data-slot="slider-track"
      className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.2)]"
    >
      <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-scene" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      data-slot="slider-thumb"
      className={cn(
        "block h-4 w-4 rounded-full border border-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.45)] bg-surface-1 shadow-sm",
        "focus-ring disabled:pointer-events-none disabled:opacity-50",
        TRANSITION_INTERACTIVE
      )}
    />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
