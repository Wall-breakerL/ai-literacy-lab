import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "ghost" | "subtle";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "border-lab bg-lab-card text-lab-fg hover:border-[rgb(var(--lab-accent))]/60 hover:text-lab-fg disabled:border-lab disabled:bg-lab-panel",
  ghost: "border-transparent bg-transparent text-lab-fg hover:border-[rgb(var(--lab-accent))]/45 hover:text-lab-fg",
  subtle: "border-transparent bg-lab-panel text-lab-muted hover:border-[rgb(var(--lab-accent))]/30 hover:text-lab-fg",
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
