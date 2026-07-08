import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-secondary/10 text-secondary",
        destructive: "bg-destructive/10 text-destructive",
        outline: "text-foreground border border-input",
        high: "bg-red-100 text-red-800",
        medium: "bg-amber-100 text-amber-800",
        low: "bg-green-100 text-green-800",
        pending: "bg-amber-100 text-amber-800",
        in_progress: "bg-blue-100 text-blue-800",
        completed: "bg-emerald-100 text-emerald-800",
        cancelled: "bg-gray-100 text-gray-800",
        active: "bg-emerald-100 text-emerald-800",
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
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
