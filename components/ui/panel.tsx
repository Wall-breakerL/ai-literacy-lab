import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-lab bg-lab-panel p-5", className)} {...props} />;
}
