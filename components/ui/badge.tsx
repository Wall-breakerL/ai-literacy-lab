import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        secondary:
          "border-white/35 bg-white/50 text-foreground backdrop-blur-sm hover:bg-white/65",
        outline: "border-border bg-transparent text-muted-foreground",
        glow:
          "border-indigo-400/55 bg-gradient-to-r from-indigo-500/20 via-violet-500/15 to-cyan-500/15 text-indigo-950 shadow-[0_0_24px_-6px_rgba(99,102,241,0.45)] backdrop-blur-md",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
