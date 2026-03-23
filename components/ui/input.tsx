import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-input bg-white/75 px-3.5 text-sm text-foreground shadow-inner shadow-indigo-950/5 outline-none transition-all placeholder:text-muted-foreground focus-visible:border-indigo-400/55 focus-visible:ring-2 focus-visible:ring-indigo-400/35 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
