import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "ghost" | "subtle";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "border-cyan-300/50 bg-cyan-950/30 text-cyan-100 hover:border-cyan-200 disabled:border-lab disabled:bg-lab-panel",
  ghost: "border-lab bg-transparent text-lab-fg hover:border-cyan-300/60 hover:text-cyan-100",
  subtle: "border-lab bg-lab-panel text-lab-muted hover:text-lab-fg",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ className, variant = "ghost", type = "button", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-lg border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASS[variant],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
