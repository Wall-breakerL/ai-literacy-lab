import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface AssessmentShellProps {
  top: ReactNode;
  subTop?: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right?: ReactNode;
  mobileLeftDrawer?: ReactNode;
  mobileRightDrawer?: ReactNode;
}

export function AssessmentShell({
  top,
  subTop,
  left,
  center,
  right,
  mobileLeftDrawer,
  mobileRightDrawer,
}: AssessmentShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1360px] flex-col gap-5 px-4 py-6 md:px-6 lg:px-8">
      <section className="lab-layer-panel rounded-xl p-4">{top}</section>
      {subTop ? <section className="lab-layer-panel rounded-xl p-4">{subTop}</section> : null}
      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="hidden min-h-0 min-w-0 lg:block">{left}</aside>
        <section className={cn("min-h-[56vh]")}>{center}</section>
        {right ? <aside className="hidden lg:block">{right}</aside> : null}
      </section>
      <section className="grid gap-3 lg:hidden">
        {mobileLeftDrawer}
        {mobileRightDrawer}
      </section>
    </main>
  );
}
