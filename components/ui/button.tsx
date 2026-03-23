import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "border border-white/10 bg-gradient-to-br from-stone-900 via-indigo-950 to-violet-950 text-white shadow-lg shadow-indigo-600/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:brightness-110",
        secondary:
          "border border-white/45 bg-white/50 text-foreground shadow-md backdrop-blur-xl hover:border-indigo-200/60 hover:bg-white/70 hover:shadow-[0_0_28px_-8px_rgba(99,102,241,0.25)]",
        outline:
          "border border-indigo-200/50 bg-white/40 text-foreground backdrop-blur-md hover:border-indigo-300/70 hover:bg-white/60",
        ghost: "text-white/90 hover:bg-white/10 hover:text-white",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base shadow-xl shadow-indigo-900/20",
        icon: "h-10 w-10 rounded-xl p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
