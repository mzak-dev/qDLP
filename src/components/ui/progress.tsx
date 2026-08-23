import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

const MotionIndicator = motion.create(ProgressPrimitive.Indicator)

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <MotionIndicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-primary"
        animate={{ x: `-${100 - (value || 0)}%` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
